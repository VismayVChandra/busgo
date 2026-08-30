import { useEffect, useState } from 'react';

import { getTodayDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import type { Absence } from '@/types/database';

/**
 * Student ids marked absent today for a driver's group, kept live via Realtime.
 * Subscribes unfiltered (absences has no group_id column to filter on) — RLS
 * via is_group_driver_of_student already scopes delivered rows to this driver's
 * own group, same justification as useSchoolFleet's unfiltered subscriptions.
 */
export function useTodayAbsences(groupId: string | null | undefined) {
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [trackedGroupId, setTrackedGroupId] = useState(groupId);
  const today = getTodayDateString();

  // Reset during render when groupId changes, rather than in an effect.
  if (groupId !== trackedGroupId) {
    setTrackedGroupId(groupId);
    setAbsentIds(new Set());
  }

  useEffect(() => {
    if (!groupId) return;

    let cancelled = false;

    supabase
      .from('absences')
      .select('*')
      .eq('absence_date', today)
      .then(({ data }) => {
        if (!cancelled) setAbsentIds(new Set(((data as Absence[]) ?? []).map((a) => a.student_id)));
      });

    const channel = supabase
      .channel(`absences:group:${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'absences' }, (payload) => {
        const row = payload.new as Absence;
        if (row.absence_date === today) setAbsentIds((current) => new Set(current).add(row.student_id));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'absences' }, (payload) => {
        const row = payload.old as Absence;
        if (row.absence_date === today) {
          setAbsentIds((current) => {
            const next = new Set(current);
            next.delete(row.student_id);
            return next;
          });
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [groupId, today]);

  return absentIds;
}
