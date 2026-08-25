-- Busgo MVP schema
-- Roles: admin, driver, parent. Auth handled by Supabase Auth (auth.users).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'driver', 'parent')),
  full_name text,
  phone text,
  push_token text,
  notify_minutes_before int not null default 5,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
-- Role/full_name are passed in via signUp() options.data.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'parent'),
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.buses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  license_plate text,
  driver_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bus_id uuid references public.buses(id),
  created_at timestamptz not null default now()
);

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  sequence_order int not null,
  created_at timestamptz not null default now()
);
create index on public.stops (route_id, sequence_order);

-- `rfid_uid` and a future `trip_events` table can be added later for
-- RFID tap-on/off attendance without changing anything else in this schema.
create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  parent_id uuid not null references public.profiles(id),
  route_id uuid not null references public.routes(id),
  stop_id uuid not null references public.stops(id),
  created_at timestamptz not null default now()
);
create index on public.students (parent_id);
create index on public.students (route_id);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id),
  bus_id uuid not null references public.buses(id),
  driver_id uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active', 'completed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index on public.trips (route_id, status);
create index on public.trips (driver_id, status);

create table public.trip_locations (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default now(),
  speed double precision,
  heading double precision
);
create index on public.trip_locations (trip_id, recorded_at desc);

-- Written only by the check-eta-notify Edge Function (service_role), never by clients.
create table public.notification_log (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (trip_id, student_id)
);

-- Realtime: stream inserts on trips/trip_locations to subscribed clients.
alter publication supabase_realtime add table public.trips, public.trip_locations;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.buses enable row level security;
alter table public.routes enable row level security;
alter table public.stops enable row level security;
alter table public.students enable row level security;
alter table public.trips enable row level security;
alter table public.trip_locations enable row level security;
alter table public.notification_log enable row level security;

create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles: read/update your own row; admin can read/update all.
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- buses / routes / stops: not sensitive, readable by any signed-in user; admin writes.
create policy "buses_select_authenticated" on public.buses
  for select to authenticated using (true);
create policy "buses_write_admin" on public.buses
  for all using (public.is_admin()) with check (public.is_admin());

create policy "routes_select_authenticated" on public.routes
  for select to authenticated using (true);
create policy "routes_write_admin" on public.routes
  for all using (public.is_admin()) with check (public.is_admin());

create policy "stops_select_authenticated" on public.stops
  for select to authenticated using (true);
create policy "stops_write_admin" on public.stops
  for all using (public.is_admin()) with check (public.is_admin());

-- students: a parent sees only their own children; admin sees all.
create policy "students_select_own_or_admin" on public.students
  for select using (parent_id = auth.uid() or public.is_admin());
create policy "students_write_admin" on public.students
  for all using (public.is_admin()) with check (public.is_admin());

-- trips: driver manages their own trips; parent reads trips on their child's route.
create policy "trips_select_parent_or_driver_or_admin" on public.trips
  for select using (
    driver_id = auth.uid()
    or public.is_admin()
    or route_id in (select route_id from public.students where parent_id = auth.uid())
  );
create policy "trips_insert_driver" on public.trips
  for insert with check (driver_id = auth.uid());
create policy "trips_update_own_driver_or_admin" on public.trips
  for update using (driver_id = auth.uid() or public.is_admin());

-- trip_locations: the sensitive one. Driver inserts only into their own active
-- trip; parent reads only locations for trips tied to their own child's route.
create policy "trip_locations_select_parent_or_driver_or_admin" on public.trip_locations
  for select using (
    public.is_admin()
    or trip_id in (select id from public.trips where driver_id = auth.uid())
    or trip_id in (
      select t.id from public.trips t
      join public.students s on s.route_id = t.route_id
      where s.parent_id = auth.uid()
    )
  );
create policy "trip_locations_insert_own_active_trip" on public.trip_locations
  for insert with check (
    trip_id in (
      select id from public.trips
      where driver_id = auth.uid() and status = 'active'
    )
  );

-- notification_log: no client access; only service_role (Edge Function) touches it.
