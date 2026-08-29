import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Student } from '@/types/database';

/** Live roster of students joined to a driver's group. */
export function useGroupRoster(groupId: string | null | undefined) {
  const [roster, setRoster] = useState<Student[]>([]);
  const [trackedGroupId, setTrackedGroupId] = useState(groupId);

  // Reset during render when groupId changes, rather than in an effect.
  if (groupId !== trackedGroupId) {
    setTrackedGroupId(groupId);
    setRoster([]);
  }

  useEffect(() => {
    if (!groupId) return;

    let cancelled = false;

    supabase
      .from('students')
      .select('*')
      .eq('group_id', groupId)
      .then(({ data }) => {
        if (!cancelled) setRoster((data as Student[]) ?? []);
      });

    const channel = supabase
      .channel(`students:group:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'students', filter: `group_id=eq.${groupId}` },
        (payload) => setRoster((current) => [...current, payload.new as Student])
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  return roster;
}
