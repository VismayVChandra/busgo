import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Megaphone } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const PRESETS = ['Running 10 min late', 'Bus delayed — traffic', 'Bus breakdown, please wait'];

type Props = { groupId: string };

export function BroadcastComposer({ groupId }: Props) {
  const theme = useTheme();
  const { profile } = useAuth();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!profile || !body.trim()) return;
    setSending(true);
    const { error } = await supabase
      .from('group_messages')
      .insert({ group_id: groupId, driver_id: profile.id, body: body.trim() });
    setSending(false);
    if (!error) {
      setBody('');
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.presetRow}>
        {PRESETS.map((preset) => (
          <Pressable key={preset} onPress={() => setBody(preset)} style={[styles.chip, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {preset}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>
      <ThemedView style={styles.row}>
        <TextField
          containerStyle={styles.input}
          placeholder="Send an update to parents"
          value={body}
          onChangeText={setBody}
        />
        <Button
          label={sent ? 'Sent' : 'Send'}
          onPress={handleSend}
          loading={sending}
          disabled={!body.trim()}
          variant="outline"
          icon={<Megaphone size={16} color={theme.primary} />}
          style={styles.sendButton}
        />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.four, marginBottom: Spacing.two, gap: Spacing.two },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.pill, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  input: { flex: 1 },
  sendButton: { paddingHorizontal: Spacing.three },
});
