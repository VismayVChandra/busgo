import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  isActive: boolean;
  busy: boolean;
  onStart: () => void;
  onEnd: () => void;
};

export function TripControls({ isActive, busy, onStart, onEnd }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={isActive ? onEnd : onStart}
      disabled={busy}
      style={[
        styles.button,
        { backgroundColor: isActive ? '#E63946' : theme.text, opacity: busy ? 0.6 : 1 },
      ]}>
      {busy ? (
        <ActivityIndicator color={theme.background} />
      ) : (
        <ThemedText type="smallBold" style={{ color: isActive ? '#ffffff' : theme.background }}>
          {isActive ? 'End trip' : 'Start trip'}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
