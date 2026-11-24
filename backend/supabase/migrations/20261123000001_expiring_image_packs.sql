alter table public.credit_packs
  add column validity_months integer check (validity_months > 0);

update public.credit_packs p
set price_paise = offer.price_paise,
    credits = offer.credits,
    bonus_credits = 0,
    validity_months = offer.validity_months
from (values
  ('starter', 149900, 100, 1),
  ('studio', 499900, 400, 3),
  ('showroom', 999900, 1000, 6)
) as offer(id, price_paise, credits, validity_months)
where p.id = offer.id;

alter table public.payments
  add column validity_months integer check (validity_months > 0),
  add column credits_expire_at timestamptz;

create table public.expiring_credits (
  payment_id uuid primary key references public.payments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  remaining integer not null check (remaining >= 0),
  expires_at timestamptz not null
);

create index expiring_credits_user_idx on public.expiring_credits(user_id, expires_at, payment_id)
  where remaining > 0;

create table public.expiring_credit_uses (
  generation_id uuid not null references public.generations(id) on delete cascade,
  payment_id uuid not null references public.expiring_credits(payment_id) on delete cascade,
  credits integer not null check (credits > 0),
  primary key (generation_id, payment_id)
);

alter table public.expiring_credits enable row level security;
alter table public.expiring_credit_uses enable row level security;
revoke all on public.expiring_credits, public.expiring_credit_uses from public, anon, authenticated;

create function public.set_payment_credit_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select validity_months into new.validity_months
    from public.credit_packs where id = new.pack_id;
  elsif old.status <> 'paid' and new.status = 'paid' and new.validity_months is not null then
    new.credits_expire_at := (
      (new.paid_at at time zone 'Asia/Kolkata') + make_interval(months => new.validity_months)
    ) at time zone 'Asia/Kolkata';
  end if;
  return new;
end;
$$;

create trigger payment_credit_expiry
before insert or update of status on public.payments
for each row execute function public.set_payment_credit_expiry();

create function public.refresh_expiring_credits(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.wallets;
  v_expired integer;
begin
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  select coalesce(sum(remaining), 0) into v_expired
  from public.expiring_credits
  where user_id = p_user_id and expires_at <= statement_timestamp() and remaining > 0;

  if v_expired > 0 then
    update public.expiring_credits set remaining = 0
    where user_id = p_user_id and expires_at <= statement_timestamp() and remaining > 0;
    update public.wallets set balance = balance - v_expired
    where user_id = p_user_id returning * into v_wallet;
    insert into public.credit_transactions(user_id, delta, balance_after, kind, description)
    values (p_user_id, -v_expired, v_wallet.balance, 'adjustment', 'Image pack credits expired');
  end if;
  return to_jsonb(v_wallet);
end;
$$;

-- Keep the existing render function and its replay/charging behavior. Expiry
-- and debits share the same wallet lock and run in one transaction.
alter function public.start_generation(uuid, text, text, jsonb, text)
  rename to start_generation_without_expiry;

create function public.start_generation(
  p_user_id uuid, p_type text, p_room_type text default null,
  p_input jsonb default '{}'::jsonb, p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_expiring_credits(p_user_id);
  return public.start_generation_without_expiry(p_user_id, p_type, p_room_type, p_input, p_idempotency_key);
end;
$$;

-- Existing payment and render functions hold the wallet lock when adding
-- their ledger entries. Only purchased, time-limited credits need tracking.
create function public.track_expiring_credit_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_batch record;
  v_needed integer;
  v_used integer;
  v_expired_refund integer;
begin
  if new.kind = 'purchase' then
    insert into public.expiring_credits(payment_id, user_id, remaining, expires_at)
    select id, user_id, credits, credits_expire_at from public.payments
    where id = new.payment_id and status = 'paid' and credits_expire_at is not null;
  elsif new.kind = 'generation' then
    v_needed := -new.delta;
    for v_batch in
      select payment_id, remaining from public.expiring_credits
      where user_id = new.user_id and expires_at > statement_timestamp() and remaining > 0
      order by expires_at, payment_id
    loop
      v_used := least(v_needed, v_batch.remaining);
      update public.expiring_credits set remaining = remaining - v_used
      where payment_id = v_batch.payment_id;
      insert into public.expiring_credit_uses(generation_id, payment_id, credits)
      values (new.generation_id, v_batch.payment_id, v_used);
      v_needed := v_needed - v_used;
      exit when v_needed = 0;
    end loop;
  elsif new.kind = 'refund' then
    update public.expiring_credits batch set remaining = batch.remaining + used.credits
    from public.expiring_credit_uses used
    where used.generation_id = new.generation_id and batch.payment_id = used.payment_id
      and batch.expires_at > statement_timestamp();

    select coalesce(sum(used.credits), 0) into v_expired_refund
    from public.expiring_credit_uses used
    join public.expiring_credits batch on batch.payment_id = used.payment_id
    where used.generation_id = new.generation_id and batch.expires_at <= statement_timestamp();

    if v_expired_refund > 0 then
      update public.wallets set balance = balance - v_expired_refund
      where user_id = new.user_id returning balance into new.balance_after;
      new.delta := new.delta - v_expired_refund;
      if new.delta = 0 then
        update public.generations set refunded = false where id = new.generation_id;
        return null;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger track_expiring_credit_transaction
before insert on public.credit_transactions
for each row
when (new.kind in ('purchase', 'generation', 'refund'))
execute function public.track_expiring_credit_transaction();

-- Return the final refund flag after the ledger trigger handles expired credits.
alter function public.fail_generation(uuid, text) rename to fail_generation_without_expiry;

create function public.fail_generation(p_generation_id uuid, p_error text default null)
returns public.generations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_generation public.generations;
begin
  perform public.fail_generation_without_expiry(p_generation_id, p_error);
  select * into v_generation from public.generations where id = p_generation_id;
  return v_generation;
end;
$$;

revoke all on function public.start_generation_without_expiry(uuid, text, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.fail_generation_without_expiry(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_payment_credit_expiry(),
  public.track_expiring_credit_transaction(), public.refresh_expiring_credits(uuid),
  public.start_generation(uuid, text, text, jsonb, text), public.fail_generation(uuid, text)
  from public, anon, authenticated;
grant execute on function public.refresh_expiring_credits(uuid),
  public.start_generation(uuid, text, text, jsonb, text), public.fail_generation(uuid, text)
  to service_role;
