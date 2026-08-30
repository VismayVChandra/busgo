-- School attendance-trends dashboard needs to read absences for its own
-- linked groups' students. absences currently has no school-facing SELECT
-- policy at all (only the student's own parent, the group's driver, or
-- admin) — this was a real gap, not by design.

create function public.is_group_school_owner_of_student(p_student_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(
    select 1 from public.students s
    where s.id = p_student_id and public.is_group_school_owner(s.group_id)
  );
$$;

drop policy "absences_select_own_or_group_driver_or_admin" on public.absences;
create policy "absences_select_own_or_group_driver_or_school_or_admin" on public.absences
  for select using (
    public.is_admin()
    or public.is_own_student(student_id)
    or public.is_group_driver_of_student(student_id)
    or public.is_group_school_owner_of_student(student_id)
  );
