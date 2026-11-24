begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  buyer_id uuid := gen_random_uuid();
  starter public.payments;
  studio public.payments;
  downgrade public.payments;
  guest public.guest_orders;
  generation jsonb;
  render_id uuid;
  original_balance integer;
  before_render integer;
  after_render integer;
begin
  insert into auth.users(id, email, email_confirmed_at)
    values (owner_id, 'wallet@example.test', now()), (buyer_id, 'guest@example.test', now());
  update public.wallets set monthly_spend_limit_paise = 1000000 where user_id = owner_id;
  select balance into original_balance from public.wallets where user_id = owner_id;

  starter := public.create_taxed_payment(owner_id, 'starter', 'razorpay', false, 149900);
  if starter.amount_paise <> 176882 or starter.base_amount_paise <> 149900 or starter.credits <> 100 then
    raise exception 'Starter checkout total, tax base, or credits do not match the catalog';
  end if;
  if (select balance from public.wallets where user_id = owner_id) <> original_balance then
    raise exception 'An unconfirmed payment granted credits';
  end if;
  starter := public.confirm_payment(starter.id, 'fixture_starter', null);
  perform public.confirm_payment(starter.id, 'fixture_starter', null);
  if (select balance from public.wallets where user_id = owner_id) <> original_balance + 100
    or (select count(*) from public.credit_transactions where payment_id = starter.id and kind = 'purchase') <> 1 then
    raise exception 'Confirmation did not settle exactly once';
  end if;

  generation := public.start_generation(owner_id, 'standard', 'Fixture', '{}'::jsonb, 'fixture-first-render');
  render_id := (generation -> 'generation' ->> 'id')::uuid;
  perform public.complete_generation(render_id, null);

  studio := public.create_taxed_payment(owner_id, 'studio', 'razorpay', false, 499900);
  studio := public.confirm_payment(studio.id, 'fixture_studio', null);
  if studio.amount_paise <> 589882 or studio.validity_months <> 3
    or (select balance from public.wallets where user_id = owner_id) <> original_balance + 499
    or (select expires_at from public.expiring_credits where payment_id = starter.id) is distinct from studio.credits_expire_at then
    raise exception 'Upgrade did not carry remaining credits into the three-month term';
  end if;

  downgrade := public.create_taxed_payment(owner_id, 'starter', 'razorpay', false, 149900);
  downgrade := public.confirm_payment(downgrade.id, 'fixture_downgrade', null);
  if downgrade.validity_months <> 1 or downgrade.credits_expire_at >= studio.credits_expire_at
    or (select expires_at from public.expiring_credits where payment_id = studio.id) is distinct from downgrade.credits_expire_at then
    raise exception 'Downgrade did not reset the remaining credits to the one-month term';
  end if;

  select balance into before_render from public.wallets where user_id = owner_id;
  generation := public.start_generation(owner_id, 'standard', 'Fixture', '{}'::jsonb, 'fixture-refunded-render');
  render_id := (generation -> 'generation' ->> 'id')::uuid;
  generation := public.start_generation(owner_id, 'standard', 'Fixture', '{}'::jsonb, 'fixture-refunded-render');
  select balance into after_render from public.wallets where user_id = owner_id;
  if not (generation ->> 'replayed')::boolean or after_render <> before_render - 1 then
    raise exception 'A retried generation did not charge exactly once';
  end if;
  perform public.fail_generation(render_id, 'fixture failure');
  begin
    perform public.fail_generation(render_id, 'fixture failure replay');
    raise exception 'A settled refund was incorrectly accepted again';
  exception when raise_exception then
    if sqlerrm <> 'GENERATION_NOT_ACTIVE' then raise; end if;
  end;
  if (select balance from public.wallets where user_id = owner_id) <> before_render then
    raise exception 'A failed generation did not refund exactly once';
  end if;

  guest := public.create_guest_order('starter', 149900, 'guest@example.test', 'Guest buyer', 'Example Studio', '+919000000000', repeat('a', 64));
  if guest.amount_paise <> 176882 or guest.payment_id is not null then
    raise exception 'Guest order contains an unexpected total or an early payment record';
  end if;
  update public.guest_orders set provider_payment_id = 'fixture_guest' where id = guest.id;
  perform public.finish_guest_order(guest.id, buyer_id, 'existing');
  perform public.finish_guest_order(guest.id, buyer_id, 'existing');
  if not exists (select 1 from public.payments where id = guest.id and user_id = buyer_id and status = 'paid')
    or (select count(*) from public.credit_transactions where payment_id = guest.id and kind = 'purchase') <> 1 then
    raise exception 'Guest checkout did not link to the buyer and settle exactly once';
  end if;
end;
$$;

rollback;
