import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentLocation } from '@/lib/location';
import { supabase } from '@/lib/supabase';

type Props = {
  onJoined: () => void;
};

export function JoinGroupForm({ onJoined }: Props) {
  const theme = useTheme();
  const [joinCode, setJoinCode] = useState('');
  const [childName, setChildName] = useState('');
  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUseCurrentLocation() {
    setError(null);
    setLocating(true);
    try {
      const location = await getCurrentLocation();
      setPickup(location);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get your location');
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    if (!pickup) return;
    setError(null);
    setLoading(true);

    const { error: rpcError } = await supabase.rpc('join_group', {
      p_join_code: joinCode.trim(),
      p_child_name: childName.trim(),
      p_pickup_lat: pickup.lat,
      p_pickup_lng: pickup.lng,
    });

    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onJoined();
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        Join a group
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
        Enter the code your driver shared with you.
      </ThemedText>

      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="Join code"
        placeholderTextColor={theme.textSecondary}
        value={joinCode}
        onChangeText={setJoinCode}
        autoCapitalize="characters"
      />
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="Child's name"
        placeholderTextColor={theme.textSecondary}
        value={childName}
        onChangeText={setChildName}
        autoCapitalize="words"
      />

      <Pressable
        onPress={handleUseCurrentLocation}
        disabled={locating}
        style={[styles.secondaryButton, { borderColor: theme.backgroundSelected }]}>
        {locating ? (
          <ActivityIndicator color={theme.text} />
        ) : (
          <ThemedText type="smallBold">
            {pickup ? `Pickup set (${pickup.lat.toFixed(4)}, ${pickup.lng.toFixed(4)})` : 'Use my current location'}
          </ThemedText>
        )}
      </Pressable>

      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={loading || !joinCode.trim() || !childName.trim() || !pickup}
        style={[styles.button, { backgroundColor: theme.text, opacity: loading ? 0.6 : 1 }]}>
        {loading ? (
          <ActivityIndicator color={theme.background} />
        ) : (
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Confirm &amp; join
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
  secondaryButton: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  error: { textAlign: 'center' },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
