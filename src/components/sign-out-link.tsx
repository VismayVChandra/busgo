import { Pressable, StyleSheet } from 'react-native';
import { LogOut } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export function SignOutLink() {
  const theme = useTheme();
  return (
    <Pressable style={styles.row} onPress={() => supabase.auth.signOut()}>
      <LogOut size={14} color={theme.textSecondary} />
      <ThemedText type="link" themeColor="textSecondary">
        Sign out
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
