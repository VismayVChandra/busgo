import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/types/database';

type Props = {
  driverId: string;
  onCreated: (group: Group) => void;
};

export function CreateGroupForm({ driverId, onCreated }: Props) {
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

      <TextField placeholder="Group name (e.g. Morning Van - Green Park)" value={name} onChangeText={setName} />
      <TextField
        placeholder="School code (optional)"
        value={schoolCode}
        onChangeText={setSchoolCode}
        autoCapitalize="characters"
      />

      {error && (
        <ThemedText type="small" themeColor="error" style={styles.subtitle}>
          {error}
        </ThemedText>
      )}

      <Button label="Create group" onPress={handleSubmit} loading={loading} disabled={!name.trim()} />
    </ThemedView>
  );
}

const styles = {
  container: { gap: Spacing.three, padding: Spacing.four },
  title: { textAlign: 'center' as const },
  subtitle: { textAlign: 'center' as const, marginBottom: Spacing.two },
};
