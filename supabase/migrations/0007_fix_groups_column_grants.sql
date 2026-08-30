-- 0006's column-level REVOKE was ineffective: Postgres column privileges are
-- additive on top of table-level privileges, not a restriction of them — a
-- standing table-wide GRANT UPDATE/INSERT ON groups TO authenticated (applied
-- automatically by Supabase's default-privileges bootstrap when the table was
-- created) still permits writing every column regardless of a column-level
-- REVOKE for a subset. Verified directly: `set role authenticated; update
-- groups set verification_status = 'verified' ...` succeeded even after 0006.
--
-- The correct fix is the other direction: revoke the table-wide privilege
-- entirely, then grant INSERT/UPDATE back only on the specific columns that
-- legitimately need direct client writes. Nothing in the app ever updates
-- `groups` directly (only inserts, and only `name`/`driver_id` — see
-- create-group-form.tsx; every other write already goes through
-- join_group/link_group_to_school/the verification RPCs), so this is a
-- tightening, not a behavior change.

revoke insert, update on public.groups from authenticated, anon;

grant insert (name, driver_id) on public.groups to authenticated;
grant update (name) on public.groups to authenticated;
