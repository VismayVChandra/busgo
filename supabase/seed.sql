-- Sample data for local development. Applied automatically by `supabase db reset`.
-- Driver/parent/admin accounts must be created through the app's sign-up screen
-- (auth.users can't be seeded from plain SQL) — see README for the full flow.

insert into public.buses (id, name, license_plate)
values ('00000000-0000-0000-0000-000000000001', 'Bus 1', 'KA-01-AB-1234');

insert into public.routes (id, name, bus_id)
values ('00000000-0000-0000-0000-000000000002', 'Route A - Morning', '00000000-0000-0000-0000-000000000001');

insert into public.stops (route_id, name, lat, lng, sequence_order) values
  ('00000000-0000-0000-0000-000000000002', 'Stop 1 - Green Park', 12.9716, 77.5946, 1),
  ('00000000-0000-0000-0000-000000000002', 'Stop 2 - Lake View', 12.9760, 77.6010, 2),
  ('00000000-0000-0000-0000-000000000002', 'Stop 3 - Hilltop', 12.9800, 77.6080, 3);
