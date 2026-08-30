-- Speeding (via check-eta-notify's existing trip_locations webhook handler)
-- and stopped-too-long (a stalled bus produces no new trip_locations row for
-- any webhook to fire on, so this needs a periodic pg_cron check instead)
-- both converge on trip_alerts, a plain append-only log. Same "no client
-- policy" shape as notification_log: only the check-eta-notify Edge Function
-- (service_role, BYPASSRLS) and the pg_cron job (runs as postgres, the table
-- owner, which bypasses RLS by default) ever write here.

create table public.trip_alerts (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  alert_type text not null check (alert_type in ('speeding', 'stopped')),
  detail text,
  created_at timestamptz not null default now()
);
create index on public.trip_alerts (trip_id, alert_type, created_at desc);

alter table public.trip_alerts enable row level security;
-- No client policy: only service_role (Edge Function) and postgres-as-owner
-- (pg_cron job) ever touch this table.

-- ---------------------------------------------------------------------------
-- Shared cooldown-gated insert, used by both detection paths, so the dedup
-- predicate lives in one place. Advisory-locks on (trip_id, alert_type) to
-- close the TOCTOU race a bare "insert ... where not exists" leaves open
-- under READ COMMITTED: two near-simultaneous callers for the same key could
-- otherwise both pass the "no recent alert" check before either commits.
-- ---------------------------------------------------------------------------

create function public.log_trip_alert(
  p_trip_id uuid,
  p_alert_type text,
  p_detail text,
  p_cooldown interval default interval '10 minutes'
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_row_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_trip_id::text || ':' || p_alert_type, 0));

  insert into public.trip_alerts (trip_id, alert_type, detail)
  select p_trip_id, p_alert_type, p_detail
  where not exists (
    select 1 from public.trip_alerts
    where trip_id = p_trip_id
      and alert_type = p_alert_type
      and created_at > now() - p_cooldown
  );

  get diagnostics v_row_count = row_count;
  return v_row_count > 0;
end;
$$;

grant execute on function public.log_trip_alert(uuid, text, text, interval) to service_role;

-- ---------------------------------------------------------------------------
-- Stopped-too-long detection. Falls back to trips.started_at when a trip has
-- zero trip_locations rows yet (GPS permission denied / never started), so a
-- trip that never pinged at all still gets flagged after p_stale_after.
-- ---------------------------------------------------------------------------

create function public.check_stalled_trips(
  p_stale_after interval default interval '10 minutes'
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
begin
  for r in
    select t.id as trip_id, t.started_at, latest.recorded_at as last_seen
    from public.trips t
    left join lateral (
      select max(tl.recorded_at) as recorded_at
      from public.trip_locations tl
      where tl.trip_id = t.id
    ) latest on true
    where t.status = 'active'
      and coalesce(latest.recorded_at, t.started_at) < now() - p_stale_after
  loop
    perform public.log_trip_alert(
      r.trip_id,
      'stopped',
      format('No location update since %s', coalesce(r.last_seen, r.started_at))
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- pg_cron: check for stalled trips every 3 minutes. Named-job form is
-- idempotent (re-running updates the existing job instead of duplicating).
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule('check-stalled-trips', '*/3 * * * *', $$select public.check_stalled_trips();$$);
