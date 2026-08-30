-- Adds three engagement features on top of the existing School/Group/Student
-- model: boarding/drop-off confirmation, absence marking, and delay/incident
-- broadcasts. Every cross-table RLS check goes through a security definer
-- helper function, never a raw subquery, per the recursion fix in
-- 0003_fix_rls_recursion.sql.

-- ---------------------------------------------------------------------------
-- boarding_events
-- ---------------------------------------------------------------------------

create table public.boarding_events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null check (status in ('boarded', 'dropped_off')),
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id),
  unique (trip_id, student_id, status)
);
create index on public.boarding_events (trip_id);

create function public.is_trip_driver(p_trip_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.trips where id = p_trip_id and driver_id = auth.uid());
$$;

create function public.is_own_student(p_student_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.students where id = p_student_id and parent_id = auth.uid());
$$;

create function public.is_trip_school_owner(p_trip_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(
    select 1 from public.trips t
    join public.groups g on g.id = t.group_id
    join public.schools sc on sc.id = g.school_id
    where t.id = p_trip_id and sc.owner_id = auth.uid()
  );
$$;

alter table public.boarding_events enable row level security;

create policy "boarding_events_select_driver_or_parent_or_school_or_admin" on public.boarding_events
  for select using (
    public.is_admin()
    or public.is_trip_driver(trip_id)
    or public.is_own_student(student_id)
    or public.is_trip_school_owner(trip_id)
  );

create policy "boarding_events_insert_own_active_trip" on public.boarding_events
  for insert with check (
    recorded_by = auth.uid()
    and public.is_trip_driver(trip_id)
    and exists(select 1 from public.trips where id = trip_id and status = 'active')
  );

-- ---------------------------------------------------------------------------
-- absences
-- ---------------------------------------------------------------------------

create table public.absences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  absence_date date not null default current_date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, absence_date)
);
create index on public.absences (student_id, absence_date);

-- DELETE payloads only carry the primary key by default; the driver's live
-- absence subscription needs student_id/absence_date on delete too.
alter table public.absences replica identity full;

create function public.is_group_driver_of_student(p_student_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(
    select 1 from public.students s
    where s.id = p_student_id and public.is_group_driver(s.group_id)
  );
$$;

alter table public.absences enable row level security;

create policy "absences_select_own_or_group_driver_or_admin" on public.absences
  for select using (
    public.is_admin()
    or public.is_own_student(student_id)
    or public.is_group_driver_of_student(student_id)
  );

create policy "absences_insert_own_student" on public.absences
  for insert with check (
    created_by = auth.uid()
    and public.is_own_student(student_id)
  );

create policy "absences_delete_own_student" on public.absences
  for delete using (public.is_own_student(student_id));

-- ---------------------------------------------------------------------------
-- group_messages
-- ---------------------------------------------------------------------------

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  driver_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.group_messages (group_id, created_at desc);

create function public.is_group_school_owner(p_group_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(
    select 1 from public.groups g
    join public.schools sc on sc.id = g.school_id
    where g.id = p_group_id and sc.owner_id = auth.uid()
  );
$$;

alter table public.group_messages enable row level security;

create policy "group_messages_select_driver_or_parent_or_school_or_admin" on public.group_messages
  for select using (
    public.is_admin()
    or public.is_group_driver(group_id)
    or public.is_group_parent(group_id)
    or public.is_group_school_owner(group_id)
  );

create policy "group_messages_insert_own_group_driver" on public.group_messages
  for insert with check (
    driver_id = auth.uid()
    and public.is_group_driver(group_id)
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.boarding_events, public.absences, public.group_messages;
