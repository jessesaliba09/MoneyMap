-- ============================================================
-- MoneyMap Supabase Schema
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste this -> Run)
-- ============================================================

-- ---------- PROFILES ----------
-- One row per user, created automatically on signup (see trigger below).
-- Holds subscription/plan state - this is what Stripe webhooks will update.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'single' check (plan in ('single','dual','premium','plus')),
  subscription_status text not null default 'active' check (subscription_status in ('active','cancelled','past_due')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------- HOLDINGS (investments) ----------
create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_class text not null check (asset_class in ('stock','etf','crypto','property','cash','business','vehicle','collectable','other')),
  ticker text,
  name text not null,
  quantity numeric not null default 1,
  price numeric not null,
  previous_close numeric not null,
  cost_basis numeric not null,
  currency text not null default 'USD',
  sector text,
  country text,
  dividend_yield numeric default 0,
  income jsonb, -- { source, amount, freq } for manually-entered investments only
  linked_debt_id uuid references public.debts(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.holdings enable row level security;

create policy "Users can manage their own holdings"
  on public.holdings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------- DEBTS ----------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('mortgage','personal_loan','car_loan','credit_card','hecs','bnpl','custom')),
  name text not null,
  lender text not null,
  balance numeric not null,
  original_balance numeric not null,
  interest_rate numeric not null default 0,
  minimum_payment numeric not null,
  term_years numeric,
  linked_investment_id uuid references public.holdings(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.debts enable row level security;

create policy "Users can manage their own debts"
  on public.debts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The two linked_*_id columns reference each other's tables, which
-- Postgres can't do in a single create statement - add holdings.linked_debt_id
-- now that debts exists.
alter table public.holdings
  add constraint holdings_linked_debt_fk
  foreign key (linked_debt_id) references public.debts(id) on delete set null;


-- ---------- GOALS ----------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  current_amount numeric not null default 0,
  target_amount numeric not null,
  target_date date,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "Users can manage their own goals"
  on public.goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------- RETIREMENT INPUTS ----------
-- One row per user (the sliders on the Retirement Planner page).
create table public.retirement_inputs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_age int not null default 34,
  retirement_age int not null default 55,
  current_investments numeric not null default 0,
  annual_contributions numeric not null default 0,
  superannuation numeric not null default 0,
  super_contribution_rate numeric not null default 11.5,
  expected_return numeric not null default 8,
  inflation numeric not null default 2.8,
  retirement_spending numeric not null default 60000,
  property_value numeric not null default 0,
  other_assets numeric not null default 0,
  life_expectancy int not null default 90,
  updated_at timestamptz not null default now()
);

alter table public.retirement_inputs enable row level security;

create policy "Users can manage their own retirement inputs"
  on public.retirement_inputs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================================
-- Done. After running this, go to Authentication -> Providers
-- and make sure Email is enabled (it is by default). Then grab
-- your Project URL and anon/public key from Project Settings ->
-- API - those two values are safe to put directly in frontend
-- code (that's what they're designed for; RLS above is what
-- actually keeps each user's data private).
-- ============================================================
