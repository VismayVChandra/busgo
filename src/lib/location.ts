import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

const PING_INTERVAL_MS = 8000;
const PING_DISTANCE_M = 20;
const QUEUE_FLUSH_INTERVAL_MS = 10000;

type QueuedPoint = {
  trip_id: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
};

function queueKey(tripId: string) {
  return `busgo:pending-locations:${tripId}`;
}

async function loadQueue(tripId: string): Promise<QueuedPoint[]> {
  const raw = await AsyncStorage.getItem(queueKey(tripId));
  return raw ? (JSON.parse(raw) as QueuedPoint[]) : [];
}

async function saveQueue(tripId: string, queue: QueuedPoint[]) {
  if (queue.length === 0) await AsyncStorage.removeItem(queueKey(tripId));
  else await AsyncStorage.setItem(queueKey(tripId), JSON.stringify(queue));
}

async function enqueue(point: QueuedPoint) {
  const queue = await loadQueue(point.trip_id);
  queue.push(point);
  await saveQueue(point.trip_id, queue);
}

/**
 * Sends every queued point for a trip, in order, stopping at the first
 * failure so ordering is preserved and nothing already queued gets lost.
 * Returns true if the queue is now fully drained (including "was already
 * empty").
 */
async function flushQueue(tripId: string): Promise<boolean> {
  const queue = await loadQueue(tripId);
  if (queue.length === 0) return true;

  let sent = 0;
  for (const point of queue) {
    const { error } = await supabase.from('trip_locations').insert(point);
    if (error) break;
    sent++;
  }
  const remaining = queue.slice(sent);
  await saveQueue(tripId, remaining);
  return remaining.length === 0;
}

/**
 * Starts foreground GPS tracking and writes a row to trip_locations on every
 * update. If a write fails (e.g. no connectivity), the point is buffered in
 * AsyncStorage instead of silently dropped, and resent — in order — on the
 * next successful attempt (either the next GPS ping, or a periodic flush
 * timer while the connection stays down and no new ping fires). Returns a
 * stop function. Background tracking is a deliberate MVP cut — see the plan
 * doc for why.
 */
export async function startTripTracking(
  tripId: string,
  onError?: (message: string | null) => void
): Promise<() => void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required to start a trip.');
  }

  // A previous session (app killed mid-trip, etc.) may have left points queued.
  await flushQueue(tripId);

  const flushTimer = setInterval(async () => {
    const drained = await flushQueue(tripId);
    if (drained) onError?.(null);
  }, QUEUE_FLUSH_INTERVAL_MS);

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: PING_INTERVAL_MS,
      distanceInterval: PING_DISTANCE_M,
    },
    async (position) => {
      const point: QueuedPoint = {
        trip_id: tripId,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: position.coords.speed,
        heading: position.coords.heading,
        recorded_at: new Date(position.timestamp).toISOString(),
      };

      // Try to clear anything already queued first, so delivery order stays
      // chronological rather than this new point arriving ahead of older ones.
      const queueDrained = await flushQueue(tripId);

      if (!queueDrained) {
        await enqueue(point);
        onError?.('Lost connection — location updates are being saved and will resend once back online.');
        return;
      }

      const { error } = await supabase.from('trip_locations').insert(point);
      if (error) {
        await enqueue(point);
        onError?.('Lost connection — location updates are being saved and will resend once back online.');
      } else {
        onError?.(null);
      }
    }
  );

  return () => {
    clearInterval(flushTimer);
    subscription.remove();
  };
}

/** Single-shot current location, used by the parent join flow to set a pickup point. */
export async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required to set your pickup point.');
  }

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}
