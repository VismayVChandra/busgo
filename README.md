# Busgo

Live school-bus/van tracking, self-service. Three roles: a **school** signs up and gets a
shareable code; a **driver** signs up, creates a group (their van/route), and optionally links it
to a school with that code; a **parent** signs up and joins a driver's group with *their* code,
setting their own pickup location. Parents then see the bus live on a map and get a push
notification a few minutes before it arrives, instead of standing around waiting.

## Stack

- React Native + Expo (TypeScript), Expo Router
- Supabase: Postgres, Realtime, Auth, one Edge Function
- OpenStreetMap via Leaflet in a WebView (`react-native-webview`) — no API key, no Google Cloud billing required
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
3. Push the schema (tables + RLS policies):
   ```bash
   npx supabase db push
   ```
   Nothing to seed — schools, groups, and students are all created through the app's UI now
   (join codes), not SQL. `auth.users` can't be seeded from plain SQL either way.
4. In Supabase Studio → Database → Replication, confirm `trips` and `trip_locations` are enabled
   for Realtime (the migration adds them to `supabase_realtime`, but worth a glance).

## 2. App environment variables

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from
Project Settings → API in Supabase Studio (the "publishable" key — safe for client use; RLS is
what actually enforces access control, so this key alone can't read data it shouldn't).

## 3. Creating accounts — fully self-service now

Since `react-native-webview` and the location/notification plugins are native modules, **Expo Go
won't run this app** — you need a dev client:

```bash
npx expo install
eas build --profile development --platform android   # or --platform ios
```

Once you have a dev client running, no Supabase Studio SQL is needed at all:

1. Sign up as a **driver** → create a group (van/route name) → you get a join code.
2. Optionally sign up as a **school** first → create it → you get a school code → paste that
   into the driver's "Link to a school" field (at group creation or later on the driver's home
   screen) to make the group show up on the school's fleet dashboard.
3. Sign up as a **parent** → enter the driver's join code, your child's name, and confirm your
   pickup location (uses your device's current location) → you land on the live map.
4. Back on the driver account, tap "Start trip" — GPS starts broadcasting. The parent's map and
   ETA update live; if linked, the school's fleet view shows the bus as "On trip" too.

An admin account (`profiles.role = 'admin'`) still exists for spot-checking via Supabase Studio,
but nothing in the core flow requires one anymore.

## 4. Push notifications (check-eta-notify)

**Not deployed yet, and currently stale** — it still queries the old `stops`/`students.route_id`
columns from before the group/school pivot. Re-pointing it to `group_id`/`pickup_lat`/`pickup_lng`
is required before deploying it; nothing breaks today since it was never live.

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
