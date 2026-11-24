create index profiles_admin_created_at_idx on public.profiles(created_at);
create index payments_admin_razorpay_created_at_idx on public.payments(created_at) where provider = 'razorpay';
create index payments_admin_razorpay_paid_at_idx on public.payments(paid_at) where provider = 'razorpay' and status = 'paid';

create function public.admin_analytics(p_days integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with range_size as (
    select case when p_days in (7, 30, 90) then p_days else 30 end as days,
      (statement_timestamp() at time zone 'Asia/Kolkata')::date as today
  ), bounds as (
    select today - (days - 1) as first_day, today,
      case days when 7 then 1 when 90 then 7 else 3 end as bucket_days
    from range_size
  ), periods as (
    select b.first_day + step as starts_on, least(b.first_day + step + b.bucket_days - 1, b.today) as ends_on
    from bounds b cross join lateral generate_series(0, b.today - b.first_day, b.bucket_days) as step
  ), series as (
    select p.starts_on, p.ends_on,
      (select count(*) from public.profiles u
        where u.created_at >= (p.starts_on::timestamp at time zone 'Asia/Kolkata')
          and u.created_at < ((p.ends_on + 1)::timestamp at time zone 'Asia/Kolkata')) as registrations,
      (select coalesce(sum(pay.amount_paise), 0) from public.payments pay
        where pay.provider = 'razorpay' and pay.status = 'paid'
          and pay.paid_at >= (p.starts_on::timestamp at time zone 'Asia/Kolkata')
          and pay.paid_at < ((p.ends_on + 1)::timestamp at time zone 'Asia/Kolkata')) as revenue_paise
    from periods p
  ), orders as (
    select count(*) filter (where p.status = 'paid') as paid,
      count(*) filter (where p.status = 'created') as created,
      count(*) filter (where p.status = 'failed') as failed,
      count(*) filter (where p.status = 'cancelled') as cancelled
    from public.payments p cross join bounds b
    where p.provider = 'razorpay'
      and p.created_at >= (b.first_day::timestamp at time zone 'Asia/Kolkata')
      and p.created_at < ((b.today + 1)::timestamp at time zone 'Asia/Kolkata')
  )
  select jsonb_build_object(
    'series', (select jsonb_agg(to_jsonb(s) order by s.starts_on) from series s),
    'orders', (select to_jsonb(o) from orders o)
  );
$$;

revoke all on function public.admin_analytics(integer) from public, anon, authenticated;
grant execute on function public.admin_analytics(integer) to service_role;
