import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Trip } from '@/types/database';

/** Resolves the currently active trip (if any) for a given group, and stays live. */
export function useActiveTrip(groupId: string | null | undefined) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackedGroupId, setTrackedGroupId] = useState(groupId);

  // Reset derived state during render when groupId changes, rather than in an
  // effect (React's recommended pattern for adjusting state from a changed prop).
  if (groupId !== trackedGroupId) {
    setTrackedGroupId(groupId);
    setTrip(null);
    setLoading(!!groupId);
  }

  useEffect(() => {
    if (!groupId) return;

    let cancelled = false;

    supabase
      .from('trips')
      .select('*')
      .eq('group_id', groupId)
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
      .channel(`trips:group:${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips', filter: `group_id=eq.${groupId}` },
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
  }, [groupId]);

  return { trip, loading };
}
