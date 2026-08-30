import { Modal, StyleSheet } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBoardingStatus } from '@/hooks/useBoardingStatus';
import type { Student } from '@/types/database';

type Props = {
  visible: boolean;
  tripId: string | null;
  roster: Student[];
  onClose: () => void;
};

export function TripEndSummary({ visible, tripId, roster, onClose }: Props) {
  const theme = useTheme();
  const statusByStudent = useBoardingStatus(tripId);

  const boardedCount = roster.filter((s) => !!statusByStudent.get(s.id)).length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <ThemedView style={styles.backdrop}>
        <ThemedView type="surface" style={[styles.card, { borderColor: theme.border }, CardShadow]}>
          <ThemedText type="subtitle">Trip ended</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {boardedCount} of {roster.length} students boarded
          </ThemedText>

          <ThemedView style={styles.list}>
            {roster.map((student) => {
              const boarded = !!statusByStudent.get(student.id);
              return (
                <ThemedView key={student.id} style={styles.row}>
                  {boarded ? (
                    <CheckCircle2 size={16} color={theme.success} />
                  ) : (
                    <XCircle size={16} color={theme.error} />
                  )}
                  <ThemedText type="default" style={styles.name}>
                    {student.full_name}
                  </ThemedText>
                  {!boarded && (
                    <ThemedText type="small" themeColor="error">
                      Did not board
                    </ThemedText>
                  )}
                </ThemedView>
              );
            })}
          </ThemedView>

          <Button label="Close" onPress={onClose} variant="primary" />
        </ThemedView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  card: { width: '100%', maxWidth: 420, padding: Spacing.four, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.three },
  subtitle: { marginTop: -Spacing.two },
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flex: 1 },
});
