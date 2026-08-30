import { Share, StyleSheet } from 'react-native';
import { Share2 } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FleetEntry } from '@/hooks/useSchoolFleet';

type Props = { schoolName: string; fleet: FleetEntry[] };

export function RouteSheet({ schoolName, fleet }: Props) {
  const theme = useTheme();

  if (fleet.length === 0) return null;

  function handleShare() {
    const lines = fleet.map((entry) => `${entry.group.name}: ${entry.group.join_code}`).join('\n');
    Share.share({ message: `${schoolName} — Busgo route sheet\n\n${lines}` });
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.headerRow}>
        <ThemedText type="smallBold">Route sheet</ThemedText>
        <Button label="Share" onPress={handleShare} variant="outline" icon={<Share2 size={14} color={theme.primary} />} style={styles.shareButton} />
      </ThemedView>
      <ThemedView style={styles.list}>
        {fleet.map((entry) => (
          <ThemedView
            key={entry.group.id}
            type="surface"
            style={[styles.row, { borderColor: theme.border }, CardShadow]}>
            <ThemedText type="default">{entry.group.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {entry.group.join_code}
            </ThemedText>
          </ThemedView>
        ))}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.four, paddingTop: 0, gap: Spacing.two },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shareButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  list: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
