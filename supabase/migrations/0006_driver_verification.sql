-- Driver verification: school-linked groups are approved by their school;
-- independent (no-school) groups upload an ID/license photo for an admin to
-- review. First feature touching Supabase Storage in this app.

alter table public.groups add column verification_status text not null default 'pending'
  check (verification_status in ('pending', 'verified', 'rejected'));
alter table public.groups add column verified_at timestamptz;
alter table public.groups add column verified_by uuid references public.profiles(id);
alter table public.groups add column id_document_path text;

-- groups_update_own (0002) has no column restriction, and PostgREST only
-- needs INSERT privilege on columns present in the request body — so without
-- this, a driver could self-verify via a raw update, or worse, via a crafted
-- insert at group-creation time. The three RPCs below still write these
-- columns fine: they're security definer, owned by postgres, which owns the
-- table and bypasses grants entirely (same pattern join_group/
-- link_group_to_school already rely on).
revoke insert (verification_status, verified_at, verified_by, id_document_path) on public.groups from authenticated, anon;
revoke update (verification_status, verified_at, verified_by, id_document_path) on public.groups from authenticated, anon;

-- A school hasn't vouched for a group just because it linked — reset
-- verification on every link/re-link.
create or replace function public.link_group_to_school(
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

  update public.groups
  set school_id = v_school_id, verification_status = 'pending', verified_at = null, verified_by = null
  where id = p_group_id;
end;
$$;

create function public.submit_driver_document(
  p_group_id uuid,
  p_storage_path text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.groups
    where id = p_group_id and driver_id = auth.uid() and school_id is null
  ) then
    raise exception 'You do not own this group, or it is linked to a school (use the school approval flow instead)';
  end if;

  if p_storage_path !~ ('^' || p_group_id::text || '/') then
    raise exception 'Storage path does not belong to this group';
  end if;

  update public.groups
  set id_document_path = p_storage_path, verification_status = 'pending', verified_at = null, verified_by = null
  where id = p_group_id;
end;
$$;

grant execute on function public.submit_driver_document(uuid, text) to authenticated;

create function public.approve_group_by_school(
  p_group_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_school_id uuid;
begin
  select school_id into v_school_id from public.groups where id = p_group_id;

  if not public.is_school_owner(v_school_id) then
    raise exception 'You do not own the school this group is linked to';
  end if;

  update public.groups
  set verification_status = case when p_approve then 'verified' else 'rejected' end,
      verified_at = now(),
      verified_by = auth.uid()
  where id = p_group_id;
end;
$$;

grant execute on function public.approve_group_by_school(uuid, boolean) to authenticated;

create function public.review_independent_driver(
  p_group_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if exists (select 1 from public.groups where id = p_group_id and school_id is not null) then
    raise exception 'This group is linked to a school; use the school approval flow instead';
  end if;

  update public.groups
  set verification_status = case when p_approve then 'verified' else 'rejected' end,
      verified_at = now(),
      verified_by = auth.uid()
  where id = p_group_id;
end;
$$;

grant execute on function public.review_independent_driver(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: driver ID/license documents for independent (no-school) drivers.
-- One path per group: {group_id}/id-document.<ext>.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('driver-documents', 'driver-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']);

create policy "driver_documents_insert_own_group" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = (select id::text from public.groups where driver_id = auth.uid())
  );

-- Supports upsert:true re-uploads overwriting the same path (e.g. after a rejection).
create policy "driver_documents_update_own_group" on storage.objects
  for update to authenticated using (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = (select id::text from public.groups where driver_id = auth.uid())
  );

-- No delete policy: nothing needs deleting since re-upload overwrites in place.

create policy "driver_documents_select_own_or_admin" on storage.objects
  for select to authenticated using (
    bucket_id = 'driver-documents'
    and (
      (storage.foldername(name))[1] = (select id::text from public.groups where driver_id = auth.uid())
      or public.is_admin()
    )
  );

-- groups was never added to the realtime publication (0002) — needed now so
-- a parent's verification badge updates live when a school/admin approves.
alter publication supabase_realtime add table public.groups;
