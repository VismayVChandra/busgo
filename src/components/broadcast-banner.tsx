import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MessageCircleWarning, X } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLatestGroupMessage } from '@/hooks/useLatestGroupMessage';

type Props = { groupId: string | null | undefined };

export function BroadcastBanner({ groupId }: Props) {
  const theme = useTheme();
  const message = useLatestGroupMessage(groupId);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  if (!message || message.id === dismissedId) return null;

  return (
    <ThemedView style={[styles.banner, { backgroundColor: theme.backgroundSelected, borderColor: theme.accent }]}>
      <MessageCircleWarning size={16} color={theme.accent} />
      <ThemedText type="small" style={styles.text}>
        {message.body}
      </ThemedText>
      <Pressable onPress={() => setDismissedId(message.id)} hitSlop={8}>
        <X size={16} color={theme.textSecondary} />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  text: { flex: 1 },
});
