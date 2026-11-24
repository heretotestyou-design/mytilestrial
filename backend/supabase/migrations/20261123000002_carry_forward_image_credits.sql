create index expiring_credits_user_deadline_idx
  on public.expiring_credits(user_id, expires_at);

create index expiring_credit_uses_payment_idx
  on public.expiring_credit_uses(payment_id);

create function public.expire_image_pack_credits(p_user_id uuid, p_cutoff timestamptz)
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
  where user_id = p_user_id and expires_at <= p_cutoff and remaining > 0;

  if v_expired > 0 then
    update public.expiring_credits set remaining = 0
    where user_id = p_user_id and expires_at <= p_cutoff and remaining > 0;

    update public.wallets set balance = balance - v_expired
    where user_id = p_user_id returning * into v_wallet;

    insert into public.credit_transactions(user_id, delta, balance_after, kind, description)
    values (p_user_id, -v_expired, v_wallet.balance, 'adjustment', 'Image pack credits expired');
  end if;
  return to_jsonb(v_wallet);
end;
$$;

create or replace function public.refresh_expiring_credits(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.expire_image_pack_credits(p_user_id, statement_timestamp());
$$;

create or replace function public.set_payment_credit_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select validity_months into new.validity_months
    from public.credit_packs where id = new.pack_id;
  elsif old.status <> 'paid' and new.status = 'paid' and new.validity_months is not null then
    -- Serialize concurrent purchases and renders before choosing a new deadline.
    perform 1 from public.wallets where user_id = new.user_id for update;
    new.paid_at := clock_timestamp();
    new.credits_expire_at := (
      (new.paid_at at time zone 'Asia/Kolkata') + make_interval(months => new.validity_months)
    ) at time zone 'Asia/Kolkata';

    perform public.expire_image_pack_credits(new.user_id, new.paid_at);
    with carried_forward as (
      update public.expiring_credits batch
      set expires_at = new.credits_expire_at
      where batch.user_id = new.user_id and batch.expires_at > new.paid_at
        and (batch.remaining > 0 or exists (
          -- A failed in-flight render may still return credits to this batch.
          select 1 from public.expiring_credit_uses used
          join public.generations g on g.id = used.generation_id
          where used.payment_id = batch.payment_id and g.status in ('queued', 'processing')
        ))
      returning batch.payment_id
    )
    update public.payments p
    set credits_expire_at = new.credits_expire_at
    from carried_forward c
    where p.id = c.payment_id;
  end if;
  return new;
end;
$$;

revoke all on function public.expire_image_pack_credits(uuid, timestamptz)
  from public, anon, authenticated, service_role;
