-- Migration 0002's RLS had two circular dependencies:
--   groups.select references students (parent link) <-> students.select references groups (driver link)
--   schools.select references groups (driver link)   <-> groups.select references schools (school link)
-- Postgres re-evaluates RLS on every table touched by a subquery, so each pair
-- recurses infinitely. Fix: security definer helper functions (same pattern as
-- is_admin()) that bypass RLS for just the narrow check being made.

create function public.is_group_driver(p_group_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.groups where id = p_group_id and driver_id = auth.uid());
$$;

create function public.is_group_parent(p_group_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.students where group_id = p_group_id and parent_id = auth.uid());
$$;

create function public.is_school_owner(p_school_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.schools where id = p_school_id and owner_id = auth.uid());
$$;

create function public.driver_linked_school_id()
returns uuid
language sql security definer set search_path = public stable
as $$
  select school_id from public.groups where driver_id = auth.uid() limit 1;
$$;

drop policy "schools_select_owner_or_linked_driver_or_admin" on public.schools;
create policy "schools_select_owner_or_linked_driver_or_admin" on public.schools
  for select using (
    owner_id = auth.uid()
    or public.is_admin()
    or id = public.driver_linked_school_id()
  );

drop policy "groups_select_owner_or_member_or_school_or_admin" on public.groups;
create policy "groups_select_owner_or_member_or_school_or_admin" on public.groups
  for select using (
    driver_id = auth.uid()
    or public.is_admin()
    or public.is_group_parent(id)
    or public.is_school_owner(school_id)
  );

drop policy "students_select_own_or_group_driver_or_admin" on public.students;
create policy "students_select_own_or_group_driver_or_admin" on public.students
  for select using (
    parent_id = auth.uid()
    or public.is_admin()
    or public.is_group_driver(group_id)
  );
