create table public.checkout_contacts (
  id integer generated always as identity (start with 2) primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text not null check (char_length(phone) between 7 and 20),
  email text not null check (char_length(email) between 3 and 254),
  company text check (char_length(company) <= 120),
  gstin text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$'),
  created_at timestamptz not null default now(),
  sheet_synced_at timestamptz
);

alter table public.checkout_contacts enable row level security;
revoke all on public.checkout_contacts from public, anon, authenticated;
grant select, insert, update on public.checkout_contacts to service_role;
grant usage on sequence public.checkout_contacts_id_seq to service_role;
create index checkout_contacts_unsynced_idx on public.checkout_contacts(id) where sheet_synced_at is null;
create index checkout_contacts_user_idx on public.checkout_contacts(user_id, id desc);

create function public.admin_checkout_overview()
returns jsonb
language sql
set search_path = ''
as $$
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'paid_orders', count(*) filter (where status = 'paid' and provider = 'razorpay'),
    'paid_amount_paise', coalesce(sum(amount_paise) filter (where status = 'paid' and provider = 'razorpay'), 0),
    'pending_sheet_rows', (select count(*) from public.checkout_contacts where sheet_synced_at is null)
  ) from public.payments;
$$;

create function public.admin_find_users(p_search text, p_offset integer, p_limit integer)
returns table (
  id uuid, email text, full_name text, company text, phone text, created_at timestamptz, balance integer
)
language sql
set search_path = ''
as $$
  select p.id, p.email, p.full_name, p.company, p.phone, p.created_at,
    greatest(coalesce(w.balance, 0) - coalesce((
      select sum(e.remaining) from public.expiring_credits e
      where e.user_id = p.id and e.expires_at <= statement_timestamp() and e.remaining > 0
    ), 0), 0)::integer
  from public.profiles p left join public.wallets w on w.user_id = p.id
  where p_search = '' or strpos(lower(concat_ws(' ', p.email, p.full_name, p.company, p.phone)), lower(p_search)) > 0
  order by p.created_at desc, p.id
  offset p_offset limit least(p_limit, 51);
$$;

revoke all on function public.admin_checkout_overview(), public.admin_find_users(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_checkout_overview(), public.admin_find_users(text, integer, integer)
  to service_role;
