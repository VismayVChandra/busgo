import { useEffect, useState } from 'react';

import { getDateRangeStrings } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import type { Absence, Student } from '@/types/database';

export type AbsenceTrend = { dates: string[]; countsByGroup: Map<string, Map<string, number>> };

const TREND_DAYS = 7;

/** Absence counts per day, per group, for the trailing week — for a school's attendance-trends view. */
export function useAbsenceTrend(groupIds: string[]) {
  const [trend, setTrend] = useState<AbsenceTrend | null>(null);
  // groupIds is a fresh array reference on every render (typically built
  // inline by the caller via .map()) — depend on this derived, stable string
  // instead, and reconstruct the id list from it inside the effect.
  const key = groupIds.slice().sort().join(',');

  const [trackedKey, setTrackedKey] = useState(key);
  // Reset during render when the group set changes, rather than in an effect.
  if (key !== trackedKey) {
    setTrackedKey(key);
    setTrend(null);
  }

  useEffect(() => {
    const currentGroupIds = key ? key.split(',') : [];
    if (currentGroupIds.length === 0) return; // nothing to fetch; trend stays null

    let cancelled = false;

    async function load() {
      const dates = getDateRangeStrings(TREND_DAYS).reverse(); // oldest -> newest
      const startDate = dates[0];

      const { data: students } = await supabase
        .from('students')
        .select('id, group_id')
        .in('group_id', currentGroupIds);
      const groupByStudentId = new Map(((students as Pick<Student, 'id' | 'group_id'>[]) ?? []).map((s) => [s.id, s.group_id]));

      if (groupByStudentId.size === 0) {
        if (!cancelled) setTrend({ dates, countsByGroup: new Map() });
        return;
      }

      const { data: absences } = await supabase
        .from('absences')
        .select('student_id, absence_date')
        .in('student_id', [...groupByStudentId.keys()])
        .gte('absence_date', startDate);

      const countsByGroup = new Map<string, Map<string, number>>();
      for (const groupId of currentGroupIds) countsByGroup.set(groupId, new Map(dates.map((d) => [d, 0])));

      for (const absence of (absences as Pick<Absence, 'student_id' | 'absence_date'>[]) ?? []) {
        const groupId = groupByStudentId.get(absence.student_id);
        if (!groupId) continue;
        const byDate = countsByGroup.get(groupId);
        if (!byDate || !byDate.has(absence.absence_date)) continue;
        byDate.set(absence.absence_date, (byDate.get(absence.absence_date) ?? 0) + 1);
      }

      if (!cancelled) setTrend({ dates, countsByGroup });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return trend;
}
