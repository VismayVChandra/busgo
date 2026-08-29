import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Locate, MapPin, Search } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { geocodeAddress, type GeocodeResult } from '@/lib/geocoding';
import { getCurrentLocation } from '@/lib/location';
import { supabase } from '@/lib/supabase';

type Props = {
  onJoined: () => void;
};

type Pickup = { lat: number; lng: number; label?: string };

export function JoinGroupForm({ onJoined }: Props) {
  const theme = useTheme();
  const [joinCode, setJoinCode] = useState('');
  const [childName, setChildName] = useState('');
  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [locating, setLocating] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUseCurrentLocation() {
    setError(null);
    setSearchResults(null);
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

  async function handleSearchAddress() {
    setError(null);
    setSearching(true);
    try {
      const results = await geocodeAddress(addressQuery);
      if (results.length === 0) setError('No matches for that address — try being more specific');
      setSearchResults(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not search for that address');
    } finally {
      setSearching(false);
    }
  }

  function handleSelectResult(result: GeocodeResult) {
    setPickup(result);
    setSearchResults(null);
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

      <TextField placeholder="Join code" value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" />
      <TextField placeholder="Child's name" value={childName} onChangeText={setChildName} autoCapitalize="words" />

      <ThemedText type="smallBold" style={styles.sectionLabel}>
        Pickup location
      </ThemedText>

      {pickup && (
        <ThemedView type="surface" style={[styles.pickupSummary, { borderColor: theme.border }]}>
          <MapPin size={15} color={theme.primary} />
          <ThemedText type="small" style={styles.pickupSummaryText}>
            {pickup.label ?? `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}`}
          </ThemedText>
        </ThemedView>
      )}

      <Button
        label="Use my current location"
        onPress={handleUseCurrentLocation}
        loading={locating}
        variant="outline"
        icon={<Locate size={16} color={theme.primary} />}
      />

      <ThemedView style={styles.dividerRow}>
        <ThemedView style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        <ThemedText type="small" themeColor="textSecondary">
          or enter an address
        </ThemedText>
        <ThemedView style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      </ThemedView>

      <ThemedView style={styles.searchRow}>
        <TextField
          containerStyle={styles.searchInput}
          placeholder="Street, area, landmark…"
          value={addressQuery}
          onChangeText={setAddressQuery}
        />
        <Button
          label="Search"
          onPress={handleSearchAddress}
          loading={searching}
          disabled={!addressQuery.trim()}
          variant="outline"
          icon={<Search size={16} color={theme.primary} />}
          style={styles.searchButton}
        />
      </ThemedView>

      {searchResults && searchResults.length > 0 && (
        <ThemedView style={styles.resultsList}>
          {searchResults.map((result, index) => (
            <Pressable
              key={`${result.lat},${result.lng},${index}`}
              onPress={() => handleSelectResult(result)}
              style={[styles.resultRow, { borderColor: theme.border }]}>
              <MapPin size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={styles.resultRowText}>
                {result.label}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      )}

      {error && (
        <ThemedText type="small" themeColor="error" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <Button
        label="Confirm & join"
        onPress={handleSubmit}
        loading={loading}
        disabled={!joinCode.trim() || !childName.trim() || !pickup}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three, padding: Spacing.four },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.two },
  sectionLabel: { marginTop: Spacing.one },
  pickupSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  pickupSummaryText: { flex: 1 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dividerLine: { flex: 1, height: 1 },
  searchRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  searchInput: { flex: 1 },
  searchButton: { paddingHorizontal: Spacing.three },
  resultsList: { gap: Spacing.one },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.two,
  },
  resultRowText: { flex: 1 },
  error: { textAlign: 'center' },
});
