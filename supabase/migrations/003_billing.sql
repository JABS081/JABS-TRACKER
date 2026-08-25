create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_id text not null default 'FREE',
  billing_interval text,
  currency text,
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_start timestamptz,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on subscriptions(user_id);
create index if not exists subscriptions_company_idx on subscriptions(company_id);
create index if not exists subscriptions_customer_idx on subscriptions(stripe_customer_id);
create index if not exists subscriptions_status_idx on subscriptions(status);

alter table subscriptions enable row level security;
drop policy if exists subscriptions_self_read on subscriptions;
create policy subscriptions_self_read on subscriptions for select to authenticated using (user_id=auth.uid() or public.jabs_is_member(company_id));

create table if not exists webhook_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
