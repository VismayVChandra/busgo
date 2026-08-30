import { StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FleetEntry } from '@/hooks/useSchoolFleet';
import { supabase } from '@/lib/supabase';

type Props = { entries: FleetEntry[] };

export function PendingGroupApprovals({ entries }: Props) {
  const theme = useTheme();

  if (entries.length === 0) return null;

  async function handleDecision(groupId: string, approve: boolean) {
    await supabase.rpc('approve_group_by_school', { p_group_id: groupId, p_approve: approve });
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="smallBold">Pending approval</ThemedText>
      {entries.map((entry) => (
        <ThemedView
          key={entry.group.id}
          type="surface"
          style={[styles.row, { borderColor: theme.border }, CardShadow]}>
          <ThemedText type="default" style={styles.name}>
            {entry.group.name}
          </ThemedText>
          <ThemedView style={styles.actions}>
            <Button
              label="Approve"
              onPress={() => handleDecision(entry.group.id, true)}
              variant="outline"
              icon={<Check size={14} color={theme.success} />}
              style={styles.actionButton}
            />
            <Button
              label="Reject"
              onPress={() => handleDecision(entry.group.id, false)}
              variant="outline"
              icon={<X size={14} color={theme.error} />}
              style={styles.actionButton}
            />
          </ThemedView>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.two,
  },
  name: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.one },
  actionButton: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
});
