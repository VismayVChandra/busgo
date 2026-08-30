import { Pressable, StyleSheet } from 'react-native';
import { LogIn, LogOut } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBoardingStatus } from '@/hooks/useBoardingStatus';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { BoardingStatus, Student } from '@/types/database';

type Props = {
  roster: Student[];
  ordered: boolean;
  tripId: string | undefined;
  tripActive: boolean;
};

export function BoardingRoster({ roster, ordered, tripId, tripActive }: Props) {
  const theme = useTheme();
  const { profile } = useAuth();
  const statusByStudent = useBoardingStatus(tripId);

  if (roster.length === 0) return null;

  async function handleMark(studentId: string, status: BoardingStatus) {
    if (!tripId || !profile) return;
    await supabase
      .from('boarding_events')
      .insert({ trip_id: tripId, student_id: studentId, status, recorded_by: profile.id });
  }

  return (
    <ThemedView style={styles.list}>
      {roster.map((student, index) => {
        const status = statusByStudent.get(student.id)?.status;
        return (
          <ThemedView key={student.id} style={styles.row}>
            <ThemedView style={styles.nameRow}>
              {ordered && (
                <ThemedView style={[styles.badge, { backgroundColor: theme.primary }]}>
                  <ThemedText type="small" style={{ color: theme.primaryForeground }}>
                    {index + 1}
                  </ThemedText>
                </ThemedView>
              )}
              <ThemedText type="small">{student.full_name}</ThemedText>
            </ThemedView>

            {tripActive && (
              <ThemedView style={styles.actions}>
                <Pressable
                  onPress={() => handleMark(student.id, 'boarded')}
                  style={[
                    styles.pill,
                    { borderColor: status === 'boarded' ? theme.success : theme.border },
                    status === 'boarded' && { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <LogIn size={13} color={status === 'boarded' ? theme.success : theme.textSecondary} />
                  <ThemedText
                    type="small"
                    style={status === 'boarded' ? { color: theme.success } : { color: theme.textSecondary }}>
                    Board
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => handleMark(student.id, 'dropped_off')}
                  style={[
                    styles.pill,
                    { borderColor: status === 'dropped_off' ? theme.primary : theme.border },
                    status === 'dropped_off' && { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <LogOut size={13} color={status === 'dropped_off' ? theme.primary : theme.textSecondary} />
                  <ThemedText
                    type="small"
                    style={status === 'dropped_off' ? { color: theme.primary } : { color: theme.textSecondary }}>
                    Drop
                  </ThemedText>
                </Pressable>
              </ThemedView>
            )}
          </ThemedView>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  badge: { width: 22, height: 22, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.one },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
