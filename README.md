# Busgo

Live school-bus tracking for parents. Parents see their child's bus on a map and get a push
notification a few minutes before it arrives at their stop, instead of standing around waiting.

## Stack

- React Native + Expo (TypeScript), Expo Router
- Supabase: Postgres, Realtime, Auth, one Edge Function
- `react-native-maps` (Google Maps on Android, Apple Maps on iOS)
- `expo-notifications` (Expo push)

See [`.claude/plans` in this repo's history](.) or ask for the original plan doc for the full
architecture writeup (schema, RLS, realtime flow, build order).

## 1. Supabase project setup

1. Create a project at [supabase.com](https://supabase.com).
2. Install the Supabase CLI if you don't have it (`npx supabase --version` works fine, no global
   install needed) and link this repo to your project:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
3. Push the schema (tables + RLS policies) and seed data:
   ```bash
   npx supabase db push
   ```
   `supabase/seed.sql` adds one sample bus/route/3 stops. It does **not** create any accounts —
   `auth.users` can't be seeded from plain SQL.
4. In Supabase Studio → Database → Replication, confirm `trips` and `trip_locations` are enabled
   for Realtime (the migration adds them to `supabase_realtime`, but worth a glance).

## 2. App environment variables

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from
Project Settings → API in Supabase Studio (the "publishable" key — safe for client use; RLS is
what actually enforces access control, so this key alone can't read data it shouldn't).

## 3. Creating accounts & sample data

Since `react-native-maps` and the location/notification plugins are native modules, **Expo Go
won't run this app** — you need a dev client:

```bash
npx expo install
eas build --profile development --platform android   # or --platform ios
```

Once you have a dev client running:

1. Sign up through the app as a parent and as a driver (the sign-up screen lets you pick a role).
2. In Supabase Studio's table editor:
   - Promote one account to admin: `update profiles set role = 'admin' where id = '<user-id>';`
   - Assign the driver to the seeded bus: `update buses set driver_id = '<driver-user-id>' where id = '00000000-0000-0000-0000-000000000001';`
   - Link a child to the parent: insert into `students` with `parent_id`, `route_id =
     '00000000-0000-0000-0000-000000000002'`, and one of the seeded `stop_id`s.
3. Sign back in — the driver should see their bus/route with a Start Trip button, and the parent
   should see the child's stop on the map.

Long-term this manual step becomes an in-app admin screen; for now Supabase Studio is faster than
building CRUD UI (see plan doc, milestone 6).

## 4. Push notifications (check-eta-notify)

1. Deploy the function and set its secret:
   ```bash
   npx supabase functions deploy check-eta-notify
   npx supabase secrets set WEBHOOK_SECRET=<a-random-string>
   ```
2. In Supabase Studio → Database → Webhooks, create a webhook on `trip_locations` INSERT that
   calls `check-eta-notify`, with a custom header `x-webhook-secret: <the-same-random-string>`.
3. Test end-to-end with the parent's app **fully backgrounded** — that's the actual point of a
   push, not just an in-app banner.

## 5. Running locally

```bash
npm run android   # or npm run ios / npm run web
```

Real GPS and push notifications don't behave reliably in simulators — test on physical hardware
before trusting a milestone as "working."

## 6. Building for the stores

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value <your-value>
eas secret:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <your-value>
eas build --profile preview --platform all     # real-device test build
eas build --profile production --platform all
eas submit --platform android
eas submit --platform ios
```

Publishing requires a Google Play Console account ($25 one-time) and an Apple Developer Program
membership ($99/year) — set those up yourself before submitting. Both stores require a privacy
policy URL at submission time since the app requests location.

Set `android.config.googleMaps.apiKey` in `app.json` (Maps SDK for Android, enabled in Google
Cloud Console) before building for Android — maps won't render without it. iOS needs no key.
