import { useEffect, useId, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { BoardingEvent } from '@/types/database';

/** Live latest boarding/drop-off event per student for a trip, kept live via Realtime. */
export function useBoardingStatus(tripId: string | null | undefined) {
  const [statusByStudent, setStatusByStudent] = useState<Map<string, BoardingEvent>>(new Map());
  const [trackedTripId, setTrackedTripId] = useState(tripId);
  // supabase.channel(topic) reuses an existing channel if the topic string
  // already exists — without a per-instance suffix, two components calling
  // this hook with the same tripId (e.g. BoardingRoster + TripEndSummary,
  // both mounted while a trip is ending) would share one channel object,
  // and the second .on() call after the first .subscribe() throws.
  const instanceId = useId();

  // Reset during render when tripId changes, rather than in an effect.
  if (tripId !== trackedTripId) {
    setTrackedTripId(tripId);
    setStatusByStudent(new Map());
  }

  useEffect(() => {
    if (!tripId) return;

    let cancelled = false;

    supabase
      .from('boarding_events')
      .select('*')
      .eq('trip_id', tripId)
      .order('recorded_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const events = (data as BoardingEvent[]) ?? [];
        setStatusByStudent(new Map(events.map((e) => [e.student_id, e])));
      });

    const channel = supabase
      .channel(`boarding_events:trip:${tripId}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'boarding_events', filter: `trip_id=eq.${tripId}` },
        (payload) => {
          const event = payload.new as BoardingEvent;
          setStatusByStudent((current) => new Map(current).set(event.student_id, event));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [tripId, instanceId]);

  return statusByStudent;
}
