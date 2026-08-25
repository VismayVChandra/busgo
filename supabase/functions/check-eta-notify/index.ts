// Triggered by a Database Webhook on trip_locations INSERT. For every student
// on the trip's route whose stop is within their notify threshold and hasn't
// already been notified for this trip, sends an Expo push and logs it.
//
// Secured with a shared secret (not withSupabase's built-in auth modes) since
// this is called by an internal Database Webhook, not an end-user client.
// Set the same value as an Edge Function secret (WEBHOOK_SECRET) and as a
// custom header on the webhook in the Supabase dashboard.

const EARTH_RADIUS_KM = 6371;
const ASSUMED_AVERAGE_SPEED_KMH = 25;

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

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: { id: number; trip_id: string; lat: number; lng: number };
};

export default {
  fetch: withSupabase({ auth: 'none' }, async (req: Request, ctx: any) => {
    const secret = req.headers.get('x-webhook-secret');
    if (!secret || secret !== Deno.env.get('WEBHOOK_SECRET')) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload: WebhookPayload = await req.json();
    if (payload.type !== 'INSERT' || payload.table !== 'trip_locations') {
      return Response.json({ skipped: true });
    }

    const { trip_id, lat, lng } = payload.record;
    const admin = ctx.supabaseAdmin;

    const { data: trip } = await admin
      .from('trips')
      .select('id, route_id, status')
      .eq('id', trip_id)
      .single();
    if (!trip || trip.status !== 'active') return Response.json({ skipped: true });

    const { data: stops } = await admin.from('stops').select('id, lat, lng').eq('route_id', trip.route_id);
    const { data: students } = await admin
      .from('students')
      .select('id, stop_id, parent_id')
      .eq('route_id', trip.route_id);
    if (!stops?.length || !students?.length) return Response.json({ notified: 0 });

    const stopById = new Map(stops.map((s: any) => [s.id, s]));
    const parentIds = [...new Set(students.map((s: any) => s.parent_id))];
    const { data: parents } = await admin
      .from('profiles')
      .select('id, push_token, notify_minutes_before')
      .in('id', parentIds);
    const parentById = new Map((parents ?? []).map((p: any) => [p.id, p]));

    const messages: { to: string; title: string; body: string }[] = [];

    for (const student of students) {
      const stop = stopById.get(student.stop_id);
      const parent = parentById.get(student.parent_id);
      if (!stop || !parent?.push_token) continue;

      const etaMinutes = estimateEtaMinutes({ lat, lng }, { lat: stop.lat, lng: stop.lng });
      if (etaMinutes > parent.notify_minutes_before) continue;

      // Insert first; only send a push if we won the race to claim this notification.
      const { data: inserted } = await admin
        .from('notification_log')
        .insert({ trip_id, student_id: student.id })
        .select('id')
        .maybeSingle();
      if (!inserted) continue; // already notified (unique constraint conflict)

      messages.push({
        to: parent.push_token,
        title: 'Bus arriving soon',
        body: `The bus is about ${Math.max(1, Math.round(etaMinutes))} min from ${stop.id === student.stop_id ? 'the stop' : 'your stop'}.`,
      });
    }

    if (messages.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
    }

    return Response.json({ notified: messages.length });
  }),
};
