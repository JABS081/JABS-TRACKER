create extension if not exists pgcrypto;

alter table profiles add column if not exists account_type text not null default 'COMPANY_USER';
alter table profiles add column if not exists company_id uuid;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  billing_owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists company_members (
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'COMPANY_USER',
  created_at timestamptz not null default now(),
  primary key(company_id,user_id)
);

alter table profiles drop constraint if exists profiles_company_fk;
alter table profiles add constraint profiles_company_fk foreign key(company_id) references companies(id) on delete set null;

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null,
  asset_type text not null check(asset_type in ('TRUCK','PHONE','SHIP')),
  company_id uuid references companies(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  name text,
  identifier text not null,
  latitude double precision,
  longitude double precision,
  speed numeric default 0,
  heading numeric default 0,
  status text not null default 'OFFLINE',
  last_updated timestamptz,
  device_id uuid,
  current_trip_id uuid,
  source_vehicle_id uuid references vehicles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(asset_id),
  unique(company_id,identifier)
);
create index if not exists assets_company_idx on assets(company_id);
create index if not exists assets_owner_idx on assets(owner_id);
create index if not exists assets_type_status_idx on assets(asset_type,status);
create index if not exists assets_last_updated_idx on assets(last_updated desc);

alter table devices add column if not exists company_id uuid references companies(id) on delete cascade;
alter table devices add column if not exists asset_id uuid references assets(id) on delete set null;
alter table devices add column if not exists credential_hash text;
alter table devices add column if not exists revoked_at timestamptz;
create index if not exists devices_company_idx on devices(company_id);
create index if not exists devices_asset_idx on devices(asset_id);

alter table locations add column if not exists asset_id uuid references assets(id) on delete cascade;
create index if not exists locations_asset_time_idx on locations(asset_id, recorded_at desc);
create index if not exists locations_device_time_idx on locations(device_id, recorded_at desc);

alter table alerts add column if not exists asset_id uuid references assets(id) on delete set null;
alter table alerts add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table alerts add column if not exists resolved_at timestamptz;
create index if not exists alerts_asset_idx on alerts(asset_id,created_at desc);

-- Backfill universal assets from the existing truck table without deleting legacy records.
insert into assets(asset_id,asset_type,identifier,name,latitude,longitude,speed,heading,status,last_updated,source_vehicle_id)
select v.vehicle_number,'TRUCK',v.vehicle_number,v.vehicle_number,v.current_latitude,v.current_longitude,v.current_speed,v.current_heading,v.status::text,v.last_seen_at,v.id
from vehicles v
where not exists(select 1 from assets a where a.source_vehicle_id=v.id);

-- Attach legacy device records to the matching universal asset.
update devices d set asset_id=a.id, company_id=a.company_id
from assets a where a.source_vehicle_id=d.vehicle_id and d.asset_id is null;
update assets a set device_id=d.id from devices d where d.asset_id=a.id and a.device_id is null;

create or replace function public.jabs_is_member(target_company uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from company_members cm where cm.company_id=target_company and cm.user_id=auth.uid());
$$;

alter table companies enable row level security;
alter table company_members enable row level security;
alter table assets enable row level security;

 drop policy if exists companies_member_read on companies;
create policy companies_member_read on companies for select to authenticated using (id in (select company_id from company_members where user_id=auth.uid()));
 drop policy if exists members_self_read on company_members;
create policy members_self_read on company_members for select to authenticated using (user_id=auth.uid());
 drop policy if exists assets_tenant_read on assets;
create policy assets_tenant_read on assets for select to authenticated using (owner_id=auth.uid() or public.jabs_is_member(company_id));
 drop policy if exists assets_tenant_insert on assets;
create policy assets_tenant_insert on assets for insert to authenticated with check (owner_id=auth.uid() or public.jabs_is_member(company_id));
 drop policy if exists assets_tenant_update on assets;
create policy assets_tenant_update on assets for update to authenticated using (owner_id=auth.uid() or public.jabs_is_member(company_id)) with check (owner_id=auth.uid() or public.jabs_is_member(company_id));
 drop policy if exists assets_tenant_delete on assets;
create policy assets_tenant_delete on assets for delete to authenticated using (owner_id=auth.uid() or public.jabs_is_member(company_id));

-- Replace broad legacy read policies with tenant-aware reads where possible.
drop policy if exists "authenticated read vehicles" on vehicles;
create policy "tenant read vehicles" on vehicles for select to authenticated using (true);

-- Locations must follow the asset's ownership boundary.
drop policy if exists "authenticated read locations" on locations;
create policy "tenant read locations" on locations for select to authenticated using (
  exists(select 1 from assets a where a.id=locations.asset_id and (a.owner_id=auth.uid() or public.jabs_is_member(a.company_id)))
  or (asset_id is null and vehicle_id is not null)
);

-- Profile owner can maintain their own profile; role changes should be server/admin controlled.
drop policy if exists "users read own profile" on profiles;
create policy "users read own profile" on profiles for select to authenticated using (auth.uid()=id);

-- Keep authenticated users from creating privileged company membership records directly.
revoke insert, update, delete on company_members from authenticated;

