import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';

const PING_INTERVAL_MS = 8000;
const PING_DISTANCE_M = 20;

/**
 * Starts foreground GPS tracking and writes a row to trip_locations on every
 * update. Returns a stop function. Background tracking is a deliberate
 * MVP cut — see the plan doc for why.
 */
export async function startTripTracking(
  tripId: string,
  onError?: (message: string) => void
): Promise<() => void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required to start a trip.');
  }

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: PING_INTERVAL_MS,
      distanceInterval: PING_DISTANCE_M,
    },
    async (position) => {
      const { error } = await supabase.from('trip_locations').insert({
        trip_id: tripId,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: position.coords.speed,
        heading: position.coords.heading,
      });
      if (error) onError?.(error.message);
    }
  );

  return () => subscription.remove();
}
