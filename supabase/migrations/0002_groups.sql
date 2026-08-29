-- Pivot: admin-provisioned buses/routes/stops -> self-service School / Group / Parent
-- hierarchy, joined by shareable codes. Clean drop-and-recreate: no real data to
-- preserve from the old model.

drop table if exists public.notification_log;
drop table if exists public.trip_locations;
drop table if exists public.trips;
drop table if exists public.students;
drop table if exists public.stops;
drop table if exists public.routes;
drop table if exists public.buses;

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'driver', 'parent', 'school'));

-- Shared 6-char code generator (unambiguous alphabet: no 0/O/1/I/L).
-- security definer so uniqueness checks see every row regardless of the
-- caller's RLS visibility (both groups and schools restrict SELECT below).
create function public.generate_join_code()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  taken boolean;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(
      select 1 from public.groups where join_code = code
      union all
      select 1 from public.schools where join_code = code
    ) into taken;
    exit when not taken;
  end loop;
  return code;
end;
$$;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  join_code text not null unique default public.generate_join_code(),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  driver_id uuid not null unique references public.profiles(id) on delete cascade,
  school_id uuid references public.schools(id),
  join_code text not null unique default public.generate_join_code(),
  created_at timestamptz not null default now()
);
create index on public.groups (school_id);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  created_at timestamptz not null default now()
);
create index on public.students (parent_id);
create index on public.students (group_id);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  driver_id uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active', 'completed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index on public.trips (group_id, status);
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

create table public.notification_log (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (trip_id, student_id)
);

alter publication supabase_realtime add table public.trips, public.trip_locations, public.students;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.schools enable row level security;
alter table public.groups enable row level security;
alter table public.students enable row level security;
alter table public.trips enable row level security;
alter table public.trip_locations enable row level security;
alter table public.notification_log enable row level security;

create policy "schools_select_owner_or_linked_driver_or_admin" on public.schools
  for select using (
    owner_id = auth.uid()
    or public.is_admin()
    or id in (select school_id from public.groups where driver_id = auth.uid() and school_id is not null)
  );
create policy "schools_insert_own_as_school_role" on public.schools
  for insert with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'school')
  );
create policy "schools_update_own" on public.schools
  for update using (owner_id = auth.uid());

create policy "groups_select_owner_or_member_or_school_or_admin" on public.groups
  for select using (
    driver_id = auth.uid()
    or public.is_admin()
    or id in (select group_id from public.students where parent_id = auth.uid())
    or school_id in (select id from public.schools where owner_id = auth.uid())
  );
create policy "groups_insert_own_as_driver_role" on public.groups
  for insert with check (
    driver_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'driver')
  );
create policy "groups_update_own" on public.groups
  for update using (driver_id = auth.uid());

create policy "students_select_own_or_group_driver_or_admin" on public.students
  for select using (
    parent_id = auth.uid()
    or public.is_admin()
    or group_id in (select id from public.groups where driver_id = auth.uid())
  );
-- No insert/update policy for parent or driver: all creation goes through
-- join_group() below (security definer, bypasses RLS by design).

create policy "trips_select_group_member_or_driver_or_school_or_admin" on public.trips
  for select using (
    driver_id = auth.uid()
    or public.is_admin()
    or group_id in (select group_id from public.students where parent_id = auth.uid())
    or group_id in (
      select id from public.groups
      where school_id in (select id from public.schools where owner_id = auth.uid())
    )
  );
create policy "trips_insert_driver" on public.trips
  for insert with check (
    driver_id = auth.uid()
    and group_id in (select id from public.groups where driver_id = auth.uid())
  );
create policy "trips_update_own_driver_or_admin" on public.trips
  for update using (driver_id = auth.uid() or public.is_admin());

create policy "trip_locations_select_group_member_or_driver_or_school_or_admin" on public.trip_locations
  for select using (
    public.is_admin()
    or trip_id in (select id from public.trips where driver_id = auth.uid())
    or trip_id in (
      select t.id from public.trips t
      join public.students s on s.group_id = t.group_id
      where s.parent_id = auth.uid()
    )
    or trip_id in (
      select t.id from public.trips t
      join public.groups g on g.id = t.group_id
      join public.schools sc on sc.id = g.school_id
      where sc.owner_id = auth.uid()
    )
  );
create policy "trip_locations_insert_own_active_trip" on public.trip_locations
  for insert with check (
    trip_id in (select id from public.trips where driver_id = auth.uid() and status = 'active')
  );

-- notification_log: no client policy at all; only service_role (Edge Function) touches it.

-- ---------------------------------------------------------------------------
-- Join RPCs — all client-facing "enter a code" flows go through these
-- (security definer, bypass RLS by design) so join codes are never exposed
-- via a general-purpose SELECT.
-- ---------------------------------------------------------------------------

create function public.join_group(
  p_join_code text,
  p_child_name text,
  p_pickup_lat double precision,
  p_pickup_lng double precision
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_group_id uuid;
  v_student_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if trim(coalesce(p_child_name, '')) = '' then
    raise exception 'Child name is required';
  end if;

  select id into v_group_id
  from public.groups
  where join_code = upper(trim(p_join_code));

  if v_group_id is null then
    raise exception 'Invalid join code';
  end if;

  insert into public.students (group_id, parent_id, full_name, pickup_lat, pickup_lng)
  values (v_group_id, auth.uid(), trim(p_child_name), p_pickup_lat, p_pickup_lng)
  returning id into v_student_id;

  return v_student_id;
end;
$$;

grant execute on function public.join_group(text, text, double precision, double precision) to authenticated;

create function public.link_group_to_school(
  p_group_id uuid,
  p_school_code text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_school_id uuid;
begin
  if not exists (select 1 from public.groups where id = p_group_id and driver_id = auth.uid()) then
    raise exception 'You do not own this group';
  end if;

  select id into v_school_id
  from public.schools
  where join_code = upper(trim(p_school_code));

  if v_school_id is null then
    raise exception 'Invalid school code';
  end if;

  update public.groups set school_id = v_school_id where id = p_group_id;
end;
$$;

grant execute on function public.link_group_to_school(uuid, text) to authenticated;

-- Known follow-up, same spirit as the deferred driver-verification gap:
-- neither RPC above is rate-limited. Not fixed in this pass.
