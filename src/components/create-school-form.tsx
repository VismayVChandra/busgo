import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { School } from '@/types/database';

type Props = {
  ownerId: string;
  onCreated: (school: School) => void;
};

export function CreateSchoolForm({ ownerId, onCreated }: Props) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    const { data: school, error: insertError } = await supabase
      .from('schools')
      .insert({ name: name.trim(), owner_id: ownerId })
      .select()
      .single();

    setLoading(false);
    if (insertError || !school) {
      setError(insertError?.message ?? 'Could not create school');
      return;
    }

    onCreated(school as School);
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        Set up your school
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
        You&apos;ll get a code that drivers can enter to link their van to your school.
      </ThemedText>

      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="School name"
        placeholderTextColor={theme.textSecondary}
        value={name}
        onChangeText={setName}
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
            Create school
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
