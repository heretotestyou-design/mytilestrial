-- =============================================================================
-- MyTilesTrial · Core schema
-- Money is always stored in PAISE (bigint, ₹1 = 100 paise). Credits are integers.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text check (char_length(full_name) <= 120),
  company     text check (char_length(company) <= 120),
  phone       text check (char_length(phone) <= 20),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Wallets: one per user. Balance can never go negative.
-- monthly_spend_limit_paise = the most a user allows themselves to spend on
-- credit purchases per calendar month (IST). Default ₹5,000. Max ₹10,00,000.
-- -----------------------------------------------------------------------------
create table public.wallets (
  user_id                    uuid primary key references public.profiles (id) on delete cascade,
  balance                    integer not null default 0 check (balance >= 0),
  lifetime_purchased         integer not null default 0 check (lifetime_purchased >= 0),
  lifetime_used              integer not null default 0 check (lifetime_used >= 0),
  monthly_spend_limit_paise  bigint  not null default 500000
                             check (monthly_spend_limit_paise between 0 and 100000000),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create trigger wallets_set_updated_at
before update on public.wallets
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Catalog: credit packs (what users buy) and generation costs (what renders cost)
-- -----------------------------------------------------------------------------
create table public.credit_packs (
  id             text primary key,
  name           text not null,
  description    text,
  credits        integer not null check (credits > 0),
  bonus_credits  integer not null default 0 check (bonus_credits >= 0),
  price_paise    bigint  not null check (price_paise > 0),
  is_featured    boolean not null default false,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create table public.generation_costs (
  type         text primary key,
  label        text not null,
  description  text,
  credits      integer not null check (credits > 0),
  is_active    boolean not null default true,
  sort_order   integer not null default 0
);

-- -----------------------------------------------------------------------------
-- Payments (provider-agnostic; "dummy" for now, Razorpay/Stripe later)
-- -----------------------------------------------------------------------------
create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  pack_id              text not null references public.credit_packs (id),
  amount_paise         bigint  not null check (amount_paise > 0),
  credits              integer not null check (credits > 0),
  currency             text not null default 'INR',
  provider             text not null default 'dummy',
  provider_order_id    text,
  provider_payment_id  text,
  status               text not null default 'created'
                       check (status in ('created', 'paid', 'failed', 'cancelled')),
  failure_reason       text,
  created_at           timestamptz not null default now(),
  paid_at              timestamptz,
  updated_at           timestamptz not null default now()
);

create index payments_user_created_idx on public.payments (user_id, created_at desc);
create index payments_user_paid_idx    on public.payments (user_id, paid_at) where status = 'paid';
create unique index payments_provider_payment_uidx
  on public.payments (provider, provider_payment_id) where provider_payment_id is not null;

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Generations: one row per image render request. Credits are charged up-front
-- and refunded automatically if the render fails.
-- -----------------------------------------------------------------------------
create table public.generations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  type             text not null references public.generation_costs (type),
  status           text not null default 'queued'
                   check (status in ('queued', 'processing', 'completed', 'failed')),
  credits_charged  integer not null check (credits_charged >= 0),
  refunded         boolean not null default false,
  room_type        text check (char_length(room_type) <= 40),
  input            jsonb not null default '{}'::jsonb,
  output_url       text,
  error            text,
  idempotency_key  text check (char_length(idempotency_key) <= 100),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index generations_user_created_idx on public.generations (user_id, created_at desc);
create unique index generations_user_idem_uidx
  on public.generations (user_id, idempotency_key) where idempotency_key is not null;

create trigger generations_set_updated_at
before update on public.generations
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Credit ledger: every balance change is recorded here (append-only).
-- -----------------------------------------------------------------------------
create table public.credit_transactions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  delta          integer not null check (delta <> 0),
  balance_after  integer not null check (balance_after >= 0),
  kind           text not null
                 check (kind in ('signup_bonus', 'purchase', 'generation', 'refund', 'adjustment')),
  payment_id     uuid references public.payments (id) on delete set null,
  generation_id  uuid references public.generations (id) on delete set null,
  description    text,
  created_at     timestamptz not null default now()
);

create index credit_transactions_user_idx on public.credit_transactions (user_id, id desc);
