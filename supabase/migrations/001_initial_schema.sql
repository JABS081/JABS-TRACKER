create extension if not exists pgcrypto;

do $$ begin create type user_role as enum ('SUPER_ADMIN','ADMIN','FLEET_MANAGER','OPERATIONS','ANALYST','DRIVER','VIEWER'); exception when duplicate_object then null; end $$;
do $$ begin create type vehicle_status as enum ('ACTIVE','INACTIVE','MOVING','STOPPED','MAINTENANCE','OFFLINE'); exception when duplicate_object then null; end $$;
do $$ begin create type trip_status as enum ('PLANNED','LOADING','TRANSIT','AT_CUSTOMER','LEAVING_CUSTOMER','RETURN_TRADE','COMPLETED','CANCELLED','DELAYED'); exception when duplicate_object then null; end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'VIEWER',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  driver_code text unique not null,
  full_name text not null,
  phone text,
  license_number text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_number text unique not null,
  plate_number text,
  vehicle_type text default 'TRUCK',
  driver_id uuid references drivers(id) on delete set null,
  status vehicle_status not null default 'INACTIVE',
  current_latitude double precision,
  current_longitude double precision,
  current_speed numeric default 0,
  current_heading numeric default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  device_code text unique not null,
  device_type text not null default 'GPS',
  vehicle_id uuid references vehicles(id) on delete set null,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  trip_number text unique not null,
  vehicle_id uuid references vehicles(id) on delete set null,
  driver_id uuid references drivers(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  origin text,
  destination text,
  status trip_status not null default 'PLANNED',
  planned_distance_km numeric,
  actual_distance_km numeric default 0,
  eta timestamptz,
  loading_started_at timestamptz,
  transit_started_at timestamptz,
  customer_arrival_at timestamptz,
  customer_departure_at timestamptz,
  return_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists locations (
  id bigint generated always as identity primary key,
  device_id uuid references devices(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  speed numeric default 0,
  heading numeric default 0,
  accuracy numeric,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists locations_vehicle_time_idx on locations(vehicle_id, recorded_at desc);

create table if not exists geofences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'CUSTOMER',
  latitude double precision not null,
  longitude double precision not null,
  radius_m numeric not null default 250,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists geofence_events (
  id bigint generated always as identity primary key,
  vehicle_id uuid references vehicles(id) on delete cascade,
  geofence_id uuid references geofences(id) on delete cascade,
  event_type text not null,
  distance_m numeric,
  occurred_at timestamptz not null default now()
);

create table if not exists trip_events (
  id bigint generated always as identity primary key,
  trip_id uuid references trips(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete set null,
  trip_id uuid references trips(id) on delete set null,
  severity text not null default 'INFO',
  alert_type text not null,
  title text not null,
  message text,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table drivers enable row level security;
alter table devices enable row level security;
alter table customers enable row level security;
alter table trips enable row level security;
alter table locations enable row level security;
alter table geofences enable row level security;
alter table geofence_events enable row level security;
alter table trip_events enable row level security;
alter table alerts enable row level security;
alter table audit_logs enable row level security;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name','')); return new; end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

drop policy if exists "authenticated read vehicles" on vehicles;
create policy "authenticated read vehicles" on vehicles for select to authenticated using (true);
drop policy if exists "authenticated read drivers" on drivers;
create policy "authenticated read drivers" on drivers for select to authenticated using (true);
drop policy if exists "authenticated read devices" on devices;
create policy "authenticated read devices" on devices for select to authenticated using (true);
drop policy if exists "authenticated read customers" on customers;
create policy "authenticated read customers" on customers for select to authenticated using (true);
drop policy if exists "authenticated read trips" on trips;
create policy "authenticated read trips" on trips for select to authenticated using (true);
drop policy if exists "authenticated read locations" on locations;
create policy "authenticated read locations" on locations for select to authenticated using (true);
drop policy if exists "authenticated read geofences" on geofences;
create policy "authenticated read geofences" on geofences for select to authenticated using (true);
drop policy if exists "authenticated read geofence events" on geofence_events;
create policy "authenticated read geofence events" on geofence_events for select to authenticated using (true);
drop policy if exists "authenticated read trip events" on trip_events;
create policy "authenticated read trip events" on trip_events for select to authenticated using (true);
drop policy if exists "authenticated read alerts" on alerts;
create policy "authenticated read alerts" on alerts for select to authenticated using (true);
drop policy if exists "users read own profile" on profiles;
create policy "users read own profile" on profiles for select to authenticated using (auth.uid() = id);

insert into vehicles (vehicle_number, plate_number, vehicle_type, status) values ('JABS-TRK-001','DEMO-001','TRUCK','ACTIVE') on conflict (vehicle_number) do nothing;
insert into devices (device_code, device_type, vehicle_id)
select 'JABS-TRK-001','GPS',id from vehicles where vehicle_number='JABS-TRK-001'
on conflict (device_code) do nothing;
insert into geofences (name,type,latitude,longitude,radius_m) values ('JABS Demo Loading Point','LOADING',6.5244,3.3792,250) on conflict do nothing;
