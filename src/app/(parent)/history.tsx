import { useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LogIn, LogOut } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { BoardingEvent } from '@/types/database';

export default function HistoryScreen() {
  const theme = useTheme();
  const { studentId, studentName } = useLocalSearchParams<{ studentId: string; studentName: string }>();
  const [events, setEvents] = useState<BoardingEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    supabase
      .from('boarding_events')
      .select('*')
      .eq('student_id', studentId)
      .order('recorded_at', { ascending: false })
      .then(({ data }) => {
        setEvents((data as BoardingEvent[]) ?? []);
        setLoaded(true);
      });
  }, [studentId]);

  if (!loaded) return null;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            No boarding history yet for {studentName ?? 'this child'}.
          </ThemedText>
        }
        renderItem={({ item }) => {
          const boarded = item.status === 'boarded';
          const date = new Date(item.recorded_at);
          return (
            <ThemedView type="surface" style={[styles.row, { borderColor: theme.border }, CardShadow]}>
              {boarded ? (
                <LogIn size={16} color={theme.success} />
              ) : (
                <LogOut size={16} color={theme.primary} />
              )}
              <ThemedView style={styles.rowText}>
                <ThemedText type="default">{boarded ? 'Boarded' : 'Dropped off'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
                  {date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.two, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: Spacing.six },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  rowText: { gap: Spacing.half },
});
