-- =============================================================================
-- MyTilesTrial · Business logic (atomic, race-safe credit operations)
--
-- Every function that moves credits or money:
--   * locks the user's wallet row (SELECT ... FOR UPDATE) so concurrent
--     requests can never double-spend,
--   * writes a ledger row in the same transaction,
--   * raises a short error CODE (e.g. INSUFFICIENT_CREDITS) that the API maps
--     to an HTTP status.
--
-- They are callable ONLY by the service role (the API). Never by clients.
-- =============================================================================

-- Credits a brand-new account receives to try the product.
create or replace function public.signup_bonus_credits()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

-- -----------------------------------------------------------------------------
-- New user → profile + wallet + welcome credits
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bonus integer := public.signup_bonus_credits();
begin
  insert into public.profiles (id, email, full_name, company)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'company'), '')
  );

  insert into public.wallets (user_id, balance) values (new.id, v_bonus);

  if v_bonus > 0 then
    insert into public.credit_transactions (user_id, delta, balance_after, kind, description)
    values (new.id, v_bonus, v_bonus, 'signup_bonus', 'Welcome trial credits');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Spend in the current calendar month (Asia/Kolkata), in paise
-- -----------------------------------------------------------------------------
create or replace function public.current_month_spend_paise(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_paise), 0)::bigint
  from public.payments
  where user_id = p_user_id
    and status = 'paid'
    and paid_at >= (date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');
$$;

-- -----------------------------------------------------------------------------
-- Update monthly spend limit
-- -----------------------------------------------------------------------------
create or replace function public.set_monthly_spend_limit(p_user_id uuid, p_limit_paise bigint)
returns public.wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.wallets;
begin
  if p_limit_paise is null or p_limit_paise < 0 or p_limit_paise > 100000000 then
    raise exception 'INVALID_SPEND_LIMIT';
  end if;

  update public.wallets
     set monthly_spend_limit_paise = p_limit_paise
   where user_id = p_user_id
  returning * into v_wallet;

  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  return v_wallet;
end;
$$;

-- -----------------------------------------------------------------------------
-- Payments step 1: create a pending payment (checks the monthly spend limit)
-- -----------------------------------------------------------------------------
create or replace function public.create_payment(
  p_user_id  uuid,
  p_pack_id  text,
  p_provider text default 'dummy'
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack    public.credit_packs;
  v_wallet  public.wallets;
  v_spent   bigint;
  v_payment public.payments;
begin
  select * into v_pack from public.credit_packs where id = p_pack_id and is_active;
  if not found then
    raise exception 'PACK_NOT_FOUND';
  end if;

  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  v_spent := public.current_month_spend_paise(p_user_id);
  if v_spent + v_pack.price_paise > v_wallet.monthly_spend_limit_paise then
    raise exception 'SPEND_LIMIT_EXCEEDED';
  end if;

  insert into public.payments (user_id, pack_id, amount_paise, credits, provider)
  values (p_user_id, v_pack.id, v_pack.price_paise, v_pack.credits + v_pack.bonus_credits, p_provider)
  returning * into v_payment;

  return v_payment;
end;
$$;

-- -----------------------------------------------------------------------------
-- Payments step 2: mark paid + add credits. Idempotent: confirming an already
-- paid payment returns it unchanged and never double-credits.
-- -----------------------------------------------------------------------------
create or replace function public.confirm_payment(
  p_payment_id          uuid,
  p_provider_payment_id text default null,
  p_provider_order_id   text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_wallet  public.wallets;
  v_pack_name text;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_payment.status = 'paid' then
    return v_payment;
  end if;

  if v_payment.status <> 'created' then
    raise exception 'PAYMENT_NOT_PENDING';
  end if;

  update public.payments
     set status = 'paid',
         paid_at = now(),
         provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
         provider_order_id   = coalesce(p_provider_order_id, provider_order_id)
   where id = p_payment_id
  returning * into v_payment;

  update public.wallets
     set balance = balance + v_payment.credits,
         lifetime_purchased = lifetime_purchased + v_payment.credits
   where user_id = v_payment.user_id
  returning * into v_wallet;

  select name into v_pack_name from public.credit_packs where id = v_payment.pack_id;

  insert into public.credit_transactions (user_id, delta, balance_after, kind, payment_id, description)
  values (v_payment.user_id, v_payment.credits, v_wallet.balance, 'purchase', v_payment.id,
          coalesce(v_pack_name, 'Credit pack') || ' purchased');

  return v_payment;
end;
$$;

-- -----------------------------------------------------------------------------
-- Payments: cancel / fail a pending payment
-- -----------------------------------------------------------------------------
create or replace function public.fail_payment(
  p_payment_id uuid,
  p_status     text default 'cancelled',
  p_reason     text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  if p_status not in ('failed', 'cancelled') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.payments
     set status = p_status, failure_reason = p_reason
   where id = p_payment_id and status = 'created'
  returning * into v_payment;

  if not found then
    raise exception 'PAYMENT_NOT_PENDING';
  end if;

  return v_payment;
end;
$$;

-- -----------------------------------------------------------------------------
-- Generations: charge credits and queue a render.
-- Pass an idempotency key to make retries safe (same key → same generation,
-- charged once).
-- -----------------------------------------------------------------------------
create or replace function public.start_generation(
  p_user_id         uuid,
  p_type            text,
  p_room_type       text  default null,
  p_input           jsonb default '{}'::jsonb,
  p_idempotency_key text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cost     public.generation_costs;
  v_wallet   public.wallets;
  v_gen      public.generations;
begin
  select * into v_cost from public.generation_costs where type = p_type and is_active;
  if not found then
    raise exception 'INVALID_GENERATION_TYPE';
  end if;

  -- Lock first so two retries with the same key serialize here.
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  if p_idempotency_key is not null then
    select * into v_gen from public.generations
     where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('generation', to_jsonb(v_gen), 'balance', v_wallet.balance, 'replayed', true);
    end if;
  end if;

  if v_wallet.balance < v_cost.credits then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.generations (user_id, type, credits_charged, room_type, input, idempotency_key)
  values (p_user_id, v_cost.type, v_cost.credits, p_room_type, coalesce(p_input, '{}'::jsonb), p_idempotency_key)
  returning * into v_gen;

  update public.wallets
     set balance = balance - v_cost.credits,
         lifetime_used = lifetime_used + v_cost.credits
   where user_id = p_user_id
  returning * into v_wallet;

  insert into public.credit_transactions (user_id, delta, balance_after, kind, generation_id, description)
  values (p_user_id, -v_cost.credits, v_wallet.balance, 'generation', v_gen.id, v_cost.label);

  return jsonb_build_object('generation', to_jsonb(v_gen), 'balance', v_wallet.balance, 'replayed', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Generations: called by the image engine when a render finishes
-- -----------------------------------------------------------------------------
create or replace function public.complete_generation(p_generation_id uuid, p_output_url text)
returns public.generations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gen public.generations;
begin
  update public.generations
     set status = 'completed', output_url = p_output_url, completed_at = now(), error = null
   where id = p_generation_id and status in ('queued', 'processing')
  returning * into v_gen;

  if not found then
    raise exception 'GENERATION_NOT_ACTIVE';
  end if;

  return v_gen;
end;
$$;

-- -----------------------------------------------------------------------------
-- Generations: mark failed and refund the credits (once)
-- -----------------------------------------------------------------------------
create or replace function public.fail_generation(p_generation_id uuid, p_error text default null)
returns public.generations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gen    public.generations;
  v_wallet public.wallets;
begin
  select * into v_gen from public.generations where id = p_generation_id for update;
  if not found then
    raise exception 'GENERATION_NOT_FOUND';
  end if;

  if v_gen.status not in ('queued', 'processing') then
    raise exception 'GENERATION_NOT_ACTIVE';
  end if;

  update public.generations
     set status = 'failed', error = p_error, refunded = (credits_charged > 0)
   where id = p_generation_id
  returning * into v_gen;

  if v_gen.credits_charged > 0 then
    update public.wallets
       set balance = balance + v_gen.credits_charged,
           lifetime_used = greatest(lifetime_used - v_gen.credits_charged, 0)
     where user_id = v_gen.user_id
    returning * into v_wallet;

    insert into public.credit_transactions (user_id, delta, balance_after, kind, generation_id, description)
    values (v_gen.user_id, v_gen.credits_charged, v_wallet.balance, 'refund', v_gen.id, 'Refund · render failed');
  end if;

  return v_gen;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lock everything down: only the service role (the API) may execute these.
-- -----------------------------------------------------------------------------
revoke all on function public.handle_new_user()                                       from public, anon, authenticated;
revoke all on function public.current_month_spend_paise(uuid)                         from public, anon, authenticated;
revoke all on function public.set_monthly_spend_limit(uuid, bigint)                   from public, anon, authenticated;
revoke all on function public.create_payment(uuid, text, text)                        from public, anon, authenticated;
revoke all on function public.confirm_payment(uuid, text, text)                       from public, anon, authenticated;
revoke all on function public.fail_payment(uuid, text, text)                          from public, anon, authenticated;
revoke all on function public.start_generation(uuid, text, text, jsonb, text)         from public, anon, authenticated;
revoke all on function public.complete_generation(uuid, text)                         from public, anon, authenticated;
revoke all on function public.fail_generation(uuid, text)                             from public, anon, authenticated;

grant execute on function public.current_month_spend_paise(uuid)                      to service_role;
grant execute on function public.set_monthly_spend_limit(uuid, bigint)                to service_role;
grant execute on function public.create_payment(uuid, text, text)                     to service_role;
grant execute on function public.confirm_payment(uuid, text, text)                    to service_role;
grant execute on function public.fail_payment(uuid, text, text)                       to service_role;
grant execute on function public.start_generation(uuid, text, text, jsonb, text)      to service_role;
grant execute on function public.complete_generation(uuid, text)                      to service_role;
grant execute on function public.fail_generation(uuid, text)                          to service_role;
