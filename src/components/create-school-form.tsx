import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { School } from '@/types/database';

type Props = {
  ownerId: string;
  onCreated: (school: School) => void;
};

export function CreateSchoolForm({ ownerId, onCreated }: Props) {
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

      <TextField placeholder="School name" value={name} onChangeText={setName} error={error ?? undefined} />

      <Button label="Create school" onPress={handleSubmit} loading={loading} disabled={!name.trim()} />
    </ThemedView>
  );
}

const styles = {
  container: { gap: Spacing.three, padding: Spacing.four },
  title: { textAlign: 'center' as const },
  subtitle: { textAlign: 'center' as const, marginBottom: Spacing.two },
};
