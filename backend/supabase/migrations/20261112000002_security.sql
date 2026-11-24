-- =============================================================================
-- MyTilesTrial · Row Level Security
-- Users can READ their own rows. All WRITES that touch money or credits go
-- through the API (service role + the functions in the next migration), so
-- no client can ever edit its own balance.
-- =============================================================================

alter table public.profiles            enable row level security;
alter table public.wallets             enable row level security;
alter table public.credit_packs        enable row level security;
alter table public.generation_costs    enable row level security;
alter table public.payments            enable row level security;
alter table public.generations         enable row level security;
alter table public.credit_transactions enable row level security;

-- Profiles: read + update own (only safe columns are granted below)
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke update on public.profiles from authenticated;
grant update (full_name, company, phone) on public.profiles to authenticated;

-- Wallets: read own only
create policy "wallets: read own"
  on public.wallets for select to authenticated
  using ((select auth.uid()) = user_id);

-- Catalog: public read of active items
create policy "credit_packs: public read"
  on public.credit_packs for select to anon, authenticated
  using (is_active);

create policy "generation_costs: public read"
  on public.generation_costs for select to anon, authenticated
  using (is_active);

-- Payments / generations / ledger: read own only
create policy "payments: read own"
  on public.payments for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "generations: read own"
  on public.generations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "credit_transactions: read own"
  on public.credit_transactions for select to authenticated
  using ((select auth.uid()) = user_id);
