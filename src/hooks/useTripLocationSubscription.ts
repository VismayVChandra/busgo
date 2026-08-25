import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { TripLocation } from '@/types/database';

/** Latest known location for a trip, kept live via Supabase Realtime. */
export function useTripLocationSubscription(tripId: string | null | undefined) {
  const [location, setLocation] = useState<TripLocation | null>(null);
  const [trackedTripId, setTrackedTripId] = useState(tripId);

  // Reset during render when tripId changes, rather than in an effect.
  if (tripId !== trackedTripId) {
    setTrackedTripId(tripId);
    setLocation(null);
  }

  useEffect(() => {
    if (!tripId) return;

    let cancelled = false;

    supabase
      .from('trip_locations')
      .select('*')
      .eq('trip_id', tripId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLocation((data as TripLocation) ?? null);
      });

    const channel = supabase
      .channel(`trip_locations:trip:${tripId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_locations', filter: `trip_id=eq.${tripId}` },
        (payload) => setLocation(payload.new as TripLocation)
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  return location;
}
