-- Minimal Supabase Auth shape needed by the migrations, in a disposable test database.
create schema extensions;
create schema auth;
create role anon;
create role authenticated;
create role service_role bypassrls;

create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
