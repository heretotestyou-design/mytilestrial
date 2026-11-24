alter table public.credit_packs add column if not exists is_test boolean not null default false;
alter table public.payments add column base_amount_paise bigint;

create function public.pack_checkout_amount(p_base bigint, p_test boolean)
returns bigint language sql immutable set search_path = ''
as $$ select p_base + case when p_test then 0 else round(p_base::numeric * 18 / 100)::bigint end $$;

create function public.create_taxed_payment(p_user_id uuid, p_pack_id text, p_provider text, p_allow_test boolean, p_expected_base bigint)
returns public.payments language plpgsql security definer set search_path = ''
as $$
declare
  v_pack public.credit_packs;
  v_payment public.payments;
  v_limit bigint;
  v_total bigint;
begin
  select * into v_pack from public.credit_packs where id = p_pack_id and is_active and (not is_test or p_allow_test) for share;
  if not found then raise exception 'PACK_NOT_FOUND'; end if;
  if p_expected_base is not null and p_expected_base <> v_pack.price_paise then raise exception 'PRICE_CHANGED'; end if;
  v_total := public.pack_checkout_amount(v_pack.price_paise, v_pack.is_test);
  select monthly_spend_limit_paise into v_limit from public.wallets where user_id = p_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if public.current_month_spend_paise(p_user_id) + v_total > v_limit then raise exception 'SPEND_LIMIT_EXCEEDED'; end if;
  insert into public.payments(user_id, pack_id, amount_paise, base_amount_paise, credits, provider)
    values(p_user_id, v_pack.id, v_total, v_pack.price_paise, v_pack.credits + v_pack.bonus_credits, p_provider)
    returning * into v_payment;
  return v_payment;
end;
$$;

create table public.guest_orders (
  id uuid primary key default gen_random_uuid(),
  access_hash text not null,
  pack_id text not null references public.credit_packs(id),
  email text not null,
  full_name text not null,
  company text not null,
  phone text not null,
  base_amount_paise bigint not null,
  amount_paise bigint not null,
  credits integer not null,
  validity_months integer,
  provider_order_id text unique,
  provider_payment_id text unique,
  payment_id uuid unique references public.payments(id),
  activation_attempted_at timestamptz,
  activation_status text check (activation_status in ('sent','existing')),
  created_at timestamptz not null default now()
);
create index guest_orders_email_created_idx on public.guest_orders(email, created_at);
alter table public.guest_orders enable row level security;
revoke all on public.guest_orders from public, anon, authenticated;
grant select, update on public.guest_orders to service_role;

alter table public.checkout_contacts alter column user_id drop not null, alter column payment_id drop not null,
  add column guest_order_id uuid unique references public.guest_orders(id) on delete cascade,
  add constraint checkout_contact_order check (guest_order_id is not null or (payment_id is not null and user_id is not null));

create function public.create_guest_order(
  p_pack_id text, p_expected_base bigint, p_email text, p_full_name text, p_company text, p_phone text, p_access_hash text
)
returns public.guest_orders language plpgsql security definer set search_path = ''
as $$
declare
  v_pack public.credit_packs;
  v_order public.guest_orders;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_email, 414));
  if (select count(*) from public.guest_orders where email = p_email and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'CHECKOUT_RATE_LIMIT';
  end if;
  select * into v_pack from public.credit_packs where id = p_pack_id and is_active and not is_test;
  if not found then raise exception 'PACK_NOT_FOUND'; end if;
  if v_pack.price_paise <> p_expected_base then raise exception 'PRICE_CHANGED'; end if;
  insert into public.guest_orders(pack_id, email, full_name, company, phone, base_amount_paise, amount_paise, credits, validity_months, access_hash)
  values(v_pack.id, p_email, p_full_name, p_company, p_phone, v_pack.price_paise, public.pack_checkout_amount(v_pack.price_paise, false), v_pack.credits + v_pack.bonus_credits, v_pack.validity_months, p_access_hash)
  returning * into v_order;
  insert into public.checkout_contacts(guest_order_id, full_name, phone, email, company)
  values(v_order.id, p_full_name, p_phone, p_email, p_company);
  return v_order;
end;
$$;

create function public.guest_order_account(p_id uuid)
returns uuid language sql security definer set search_path = ''
as $$
  select u.id from public.guest_orders g
  join auth.users u on lower(u.email) = g.email
  where g.id = p_id and g.provider_payment_id is not null and u.email_confirmed_at is not null
  limit 1
$$;

create function public.finish_guest_order(p_id uuid, p_user_id uuid, p_activation text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.guest_orders;
begin
  select * into v_order from public.guest_orders where id = p_id for update;
  if v_order.payment_id is not null then return; end if;
  if v_order.provider_payment_id is null or p_activation not in ('sent','existing') or not exists (
    select 1 from auth.users where id = p_user_id and lower(email) = v_order.email
      and (p_activation = 'sent' or email_confirmed_at is not null)
  ) then raise exception 'PAYMENT_NOT_PENDING'; end if;
  insert into public.payments(id, user_id, pack_id, amount_paise, base_amount_paise, credits, provider, provider_order_id)
    values(v_order.id, p_user_id, v_order.pack_id, v_order.amount_paise, v_order.base_amount_paise, v_order.credits, 'razorpay', v_order.provider_order_id);
  update public.payments set validity_months = v_order.validity_months where id = v_order.id;
  perform public.confirm_payment(v_order.id, v_order.provider_payment_id, null);
  update public.guest_orders set payment_id = v_order.id, activation_status = p_activation where id = v_order.id;
  update public.checkout_contacts set payment_id = v_order.id, user_id = p_user_id where guest_order_id = v_order.id;
end;
$$;

create function public.copy_signup_phone()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_phone text := trim(new.raw_user_meta_data ->> 'phone');
begin
  if v_phone ~ '^\+?[0-9 ()-]{7,19}$' then
    update public.profiles set phone = v_phone where id = new.id;
  end if;
  return new;
end;
$$;
create trigger sync_signup_phone after insert on auth.users for each row execute function public.copy_signup_phone();

revoke all on function public.pack_checkout_amount(bigint, boolean),
  public.create_taxed_payment(uuid, text, text, boolean, bigint),
  public.create_guest_order(text, bigint, text, text, text, text, text),
  public.guest_order_account(uuid), public.finish_guest_order(uuid, uuid, text), public.copy_signup_phone()
  from public, anon, authenticated;
grant execute on function public.create_taxed_payment(uuid, text, text, boolean, bigint),
  public.create_guest_order(text, bigint, text, text, text, text, text), public.guest_order_account(uuid),
  public.finish_guest_order(uuid, uuid, text) to service_role;
