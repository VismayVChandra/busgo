import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/types/database';

type Props = {
  driverId: string;
  onCreated: (group: Group) => void;
};

export function CreateGroupForm({ driverId, onCreated }: Props) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    const { data: group, error: insertError } = await supabase
      .from('groups')
      .insert({ name: name.trim(), driver_id: driverId })
      .select()
      .single();

    if (insertError || !group) {
      setLoading(false);
      setError(insertError?.message ?? 'Could not create group');
      return;
    }

    if (schoolCode.trim()) {
      const { error: linkError } = await supabase.rpc('link_group_to_school', {
        p_group_id: group.id,
        p_school_code: schoolCode.trim(),
      });
      if (linkError) {
        // Group was created either way; surface the link failure but don't block.
        setError(`Group created, but linking to school failed: ${linkError.message}`);
      }
    }

    setLoading(false);
    onCreated(group as Group);
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        Create your group
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
        This represents your van or route. You&apos;ll get a code to share with parents.
      </ThemedText>

      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="Group name (e.g. Morning Van - Green Park)"
        placeholderTextColor={theme.textSecondary}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="School code (optional)"
        placeholderTextColor={theme.textSecondary}
        value={schoolCode}
        onChangeText={setSchoolCode}
        autoCapitalize="characters"
      />

      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={loading || !name.trim()}
        style={[styles.button, { backgroundColor: theme.text, opacity: loading ? 0.6 : 1 }]}>
        {loading ? (
          <ActivityIndicator color={theme.background} />
        ) : (
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Create group
          </ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three, padding: Spacing.four },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  error: { textAlign: 'center' },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
