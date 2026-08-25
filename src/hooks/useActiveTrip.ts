import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Trip } from '@/types/database';

/** Resolves the currently active trip (if any) for a given route, and stays live. */
export function useActiveTrip(routeId: string | null | undefined) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackedRouteId, setTrackedRouteId] = useState(routeId);

  // Reset derived state during render when routeId changes, rather than in an
  // effect (React's recommended pattern for adjusting state from a changed prop).
  if (routeId !== trackedRouteId) {
    setTrackedRouteId(routeId);
    setTrip(null);
    setLoading(!!routeId);
  }

  useEffect(() => {
    if (!routeId) return;

    let cancelled = false;

    supabase
      .from('trips')
      .select('*')
      .eq('route_id', routeId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setTrip((data as Trip) ?? null);
          setLoading(false);
        }
      });

    const channel = supabase
      .channel(`trips:route:${routeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips', filter: `route_id=eq.${routeId}` },
        (payload) => {
          const row = payload.new as Trip;
          if (payload.eventType === 'DELETE') {
            setTrip(null);
          } else if (row.status === 'active') {
            setTrip(row);
          } else {
            setTrip((current) => (current?.id === row.id ? null : current));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [routeId]);

  return { trip, loading };
}
