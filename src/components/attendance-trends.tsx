import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAbsenceTrend } from '@/hooks/useAbsenceTrend';
import type { FleetEntry } from '@/hooks/useSchoolFleet';

type Props = { entries: FleetEntry[] };

const BAR_MAX_HEIGHT = 28;

export function AttendanceTrends({ entries }: Props) {
  const theme = useTheme();
  const trend = useAbsenceTrend(entries.map((e) => e.group.id));

  if (entries.length === 0 || !trend) return null;

  const maxCount = Math.max(1, ...[...trend.countsByGroup.values()].flatMap((byDate) => [...byDate.values()]));

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="smallBold">Attendance trend (last 7 days)</ThemedText>
      {entries.map((entry) => {
        const byDate = trend.countsByGroup.get(entry.group.id);
        const weekTotal = byDate ? [...byDate.values()].reduce((a, b) => a + b, 0) : 0;
        return (
          <ThemedView key={entry.group.id} type="surface" style={[styles.card, { borderColor: theme.border }, CardShadow]}>
            <ThemedView style={styles.cardHeader}>
              <ThemedText type="default">{entry.group.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {weekTotal} absence{weekTotal === 1 ? '' : 's'} this week
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.bars}>
              {trend.dates.map((date) => {
                const count = byDate?.get(date) ?? 0;
                const height = count === 0 ? 2 : Math.max(4, (count / maxCount) * BAR_MAX_HEIGHT);
                return (
                  <ThemedView key={date} style={styles.barColumn}>
                    <ThemedView
                      style={[
                        styles.bar,
                        { height, backgroundColor: count > 0 ? theme.accent : theme.border },
                      ]}
                    />
                    <ThemedText type="small" themeColor="textSecondary" style={styles.barLabel}>
                      {new Date(date).toLocaleDateString([], { weekday: 'narrow' })}
                    </ThemedText>
                  </ThemedView>
                );
              })}
            </ThemedView>
          </ThemedView>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1, gap: Spacing.two },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.one, height: BAR_MAX_HEIGHT + 18 },
  barColumn: { alignItems: 'center', gap: Spacing.half, flex: 1 },
  bar: { width: 10, borderRadius: 3 },
  barLabel: { fontSize: 10 },
});
