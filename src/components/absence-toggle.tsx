import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { CalendarOff } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { getDateRangeStrings, getTodayDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';

const DURATIONS = [
  { label: 'Today', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
];

type Props = { studentId: string };

export function AbsenceToggle({ studentId }: Props) {
  const theme = useTheme();
  const { profile } = useAuth();
  const [absenceId, setAbsenceId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const today = getTodayDateString();
  const [trackedStudentId, setTrackedStudentId] = useState(studentId);

  // Reset during render when studentId changes, rather than in an effect.
  if (studentId !== trackedStudentId) {
    setTrackedStudentId(studentId);
    setChecked(false);
    setAbsenceId(null);
  }

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('absences')
      .select('id')
      .eq('student_id', studentId)
      .eq('absence_date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setAbsenceId(data?.id ?? null);
        setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, today]);

  async function handleUndo() {
    if (!absenceId) return;
    setLoading(true);
    const { error } = await supabase.from('absences').delete().eq('id', absenceId);
    if (!error) setAbsenceId(null);
    setLoading(false);
  }

  async function handleMarkAbsent(days: number) {
    if (!profile) return;
    setLoading(true);
    const rows = getDateRangeStrings(days).map((absence_date) => ({
      student_id: studentId,
      absence_date,
      created_by: profile.id,
    }));
    // ON CONFLICT DO NOTHING only needs INSERT privilege (no UPDATE policy
    // exists on absences), and silently skips any day already marked.
    const { error } = await supabase
      .from('absences')
      .upsert(rows, { onConflict: 'student_id,absence_date', ignoreDuplicates: true });
    if (!error) {
      const { data } = await supabase
        .from('absences')
        .select('id')
        .eq('student_id', studentId)
        .eq('absence_date', today)
        .maybeSingle();
      setAbsenceId(data?.id ?? null);
    }
    setLoading(false);
  }

  if (!checked) return null;

  if (absenceId) {
    return (
      <Button
        label="Marked absent today — tap to undo"
        onPress={handleUndo}
        loading={loading}
        variant="secondary"
        icon={<CalendarOff size={16} color={theme.text} />}
      />
    );
  }

  return (
    <ThemedView style={styles.row}>
      <CalendarOff size={16} color={theme.primary} />
      <ThemedText type="small" themeColor="textSecondary">
        Mark absent:
      </ThemedText>
      {DURATIONS.map(({ label, days }) => (
        <Pressable
          key={label}
          onPress={() => handleMarkAbsent(days)}
          disabled={loading}
          style={[styles.chip, { borderColor: theme.border, opacity: loading ? 0.6 : 1 }]}>
          <ThemedText type="smallBold" themeColor="primary">
            {label}
          </ThemedText>
        </Pressable>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
