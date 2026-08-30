import { StyleSheet } from 'react-native';
import { LogIn, LogOut } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBoardingStatus } from '@/hooks/useBoardingStatus';

type Props = {
  tripId: string | undefined;
  studentId: string;
};

export function BoardingStatusBadge({ tripId, studentId }: Props) {
  const theme = useTheme();
  const statusByStudent = useBoardingStatus(tripId);
  const event = statusByStudent.get(studentId);

  if (!event) return null;

  const time = new Date(event.recorded_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const label = event.status === 'boarded' ? `Boarded at ${time}` : `Dropped off at ${time}`;
  const color = event.status === 'boarded' ? theme.success : theme.primary;
  const Icon = event.status === 'boarded' ? LogIn : LogOut;

  return (
    <ThemedView style={styles.row}>
      <Icon size={13} color={color} />
      <ThemedText type="small" style={{ color }}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.one },
});
