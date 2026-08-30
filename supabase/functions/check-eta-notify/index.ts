// Triggered by Database Webhooks on trip_locations, boarding_events, and
// group_messages INSERTs, dispatched on payload.table. The name is historical
// (this started as an ETA-only check) but stayed put once a real webhook
// pointed at it — renaming later means re-pointing a live webhook.
//
// Secured with a shared secret since this is called by internal Database
// Webhooks, not an end-user client. Set the same value as an Edge Function
// secret (WEBHOOK_SECRET) and as a custom header on each webhook in the
// Supabase dashboard.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Duplicated from src/lib/eta.ts — Edge Functions run in a separate Deno
// process from the app bundle, so this can't be a shared import.
const EARTH_RADIUS_KM = 6371;
const ASSUMED_AVERAGE_SPEED_KMH = 25;
const SPEED_ALERT_THRESHOLD_MPS = 25; // ~90 km/h

function haversineDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateEtaMinutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  return (haversineDistanceKm(from, to) / ASSUMED_AVERAGE_SPEED_KMH) * 60;
}

type ExpoMessage = { to: string; title: string; body: string };

async function sendExpoPush(messages: ExpoMessage[]) {
  if (messages.length === 0) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
}

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, any>;
};

Deno.serve(async (req) => {
  const secret = req.headers.get('x-webhook-secret');
  if (!secret || secret !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const payload: WebhookPayload = await req.json();
  if (payload.type !== 'INSERT') return Response.json({ skipped: true });

  switch (payload.table) {
    case 'trip_locations':
      return handleEtaCheck(admin, payload.record);
    case 'boarding_events':
      return handleBoardingNotify(admin, payload.record);
    case 'group_messages':
      return handleBroadcastNotify(admin, payload.record);
    case 'trip_alerts':
      return handleTripAlertNotify(admin, payload.record);
    default:
      return Response.json({ skipped: true });
  }
});

async function handleEtaCheck(admin: SupabaseClient, record: any) {
  const { trip_id, lat, lng, speed } = record;

  const { data: trip } = await admin
    .from('trips')
    .select('id, group_id, status')
    .eq('id', trip_id)
    .single();
  if (!trip || trip.status !== 'active') return Response.json({ skipped: true });

  // speed can be null, or occasionally negative on some Android devices when
  // GPS speed is unreliable — only treat a genuine non-negative reading as signal.
  if (typeof speed === 'number' && speed >= 0 && speed > SPEED_ALERT_THRESHOLD_MPS) {
    await admin.rpc('log_trip_alert', {
      p_trip_id: trip_id,
      p_alert_type: 'speeding',
      p_detail: `Speed ${speed.toFixed(1)} m/s`,
    });
  }

  const { data: students } = await admin
    .from('students')
    .select('id, full_name, parent_id, pickup_lat, pickup_lng')
    .eq('group_id', trip.group_id);
  if (!students?.length) return Response.json({ notified: 0 });

  const parentIds = [...new Set(students.map((s: any) => s.parent_id))];
  const { data: parents } = await admin
    .from('profiles')
    .select('id, push_token, notify_minutes_before')
    .in('id', parentIds);
  const parentById = new Map((parents ?? []).map((p: any) => [p.id, p]));

  const messages: ExpoMessage[] = [];

  for (const student of students) {
    const parent = parentById.get(student.parent_id);
    if (!parent?.push_token) continue;

    const etaMinutes = estimateEtaMinutes(
      { lat, lng },
      { lat: student.pickup_lat, lng: student.pickup_lng }
    );
    if (etaMinutes > parent.notify_minutes_before) continue;

    // Insert first; only send a push if we won the race to claim this notification.
    const { data: inserted } = await admin
      .from('notification_log')
      .insert({ trip_id, student_id: student.id })
      .select('id')
      .maybeSingle();
    if (!inserted) continue; // already notified for this trip (unique constraint conflict)

    messages.push({
      to: parent.push_token,
      title: 'Bus arriving soon',
      body: `The bus is about ${Math.max(1, Math.round(etaMinutes))} min from ${student.full_name}'s pickup point.`,
    });
  }

  await sendExpoPush(messages);
  return Response.json({ notified: messages.length });
}

async function handleBoardingNotify(admin: SupabaseClient, record: any) {
  const { student_id, status } = record;

  const { data: student } = await admin
    .from('students')
    .select('full_name, parent_id')
    .eq('id', student_id)
    .single();
  if (!student) return Response.json({ skipped: true });

  const { data: parent } = await admin
    .from('profiles')
    .select('push_token')
    .eq('id', student.parent_id)
    .single();
  if (!parent?.push_token) return Response.json({ notified: 0 });

  const body =
    status === 'boarded' ? `${student.full_name} boarded the bus.` : `${student.full_name} was dropped off.`;

  await sendExpoPush([{ to: parent.push_token, title: 'Busgo', body }]);
  return Response.json({ notified: 1 });
}

async function handleTripAlertNotify(admin: SupabaseClient, record: any) {
  const { trip_id, alert_type, detail } = record;

  const { data: trip } = await admin.from('trips').select('group_id').eq('id', trip_id).single();
  if (!trip) return Response.json({ skipped: true });

  const { data: group } = await admin.from('groups').select('school_id').eq('id', trip.group_id).single();
  if (!group?.school_id) return Response.json({ skipped: true }); // independent groups have no school to notify

  const { data: school } = await admin.from('schools').select('owner_id').eq('id', group.school_id).single();
  if (!school) return Response.json({ skipped: true });

  const { data: owner } = await admin.from('profiles').select('push_token').eq('id', school.owner_id).single();
  if (!owner?.push_token) return Response.json({ notified: 0 });

  const title = alert_type === 'speeding' ? 'Bus going too fast' : 'Bus has not moved';
  await sendExpoPush([{ to: owner.push_token, title, body: detail ?? '' }]);
  return Response.json({ notified: 1 });
}

async function handleBroadcastNotify(admin: SupabaseClient, record: any) {
  const { group_id, body } = record;

  const { data: students } = await admin.from('students').select('parent_id').eq('group_id', group_id);
  if (!students?.length) return Response.json({ notified: 0 });

  const parentIds = [...new Set(students.map((s: any) => s.parent_id))];
  const { data: parents } = await admin.from('profiles').select('push_token').in('id', parentIds);

  const messages: ExpoMessage[] = (parents ?? [])
    .filter((p: any) => p.push_token)
    .map((p: any) => ({ to: p.push_token, title: 'Busgo alert', body }));

  await sendExpoPush(messages);
  return Response.json({ notified: messages.length });
}
