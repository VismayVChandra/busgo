import { StyleSheet } from 'react-native';
import { Clock, XCircle } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGroupVerification } from '@/hooks/useGroupVerification';

type Props = { groupId: string };

export function GroupVerificationBadge({ groupId }: Props) {
  const theme = useTheme();
  const status = useGroupVerification(groupId);

  if (!status || status === 'verified') return null;

  const isRejected = status === 'rejected';
  const Icon = isRejected ? XCircle : Clock;
  const color = isRejected ? theme.error : theme.textSecondary;

  return (
    <ThemedView style={styles.row}>
      <Icon size={13} color={color} />
      <ThemedText type="small" style={{ color }}>
        {isRejected ? 'Driver verification was not approved' : 'Driver verification pending'}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.one },
});
