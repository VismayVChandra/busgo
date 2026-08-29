import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateGroupForm } from '@/components/create-group-form';
import { BusMap } from '@/components/map-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripControls } from '@/components/trip-controls';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { useGroupRoster } from '@/hooks/useGroupRoster';
import { useTripLocationSubscription } from '@/hooks/useTripLocationSubscription';
import { useAuth } from '@/lib/auth';
import { startTripTracking } from '@/lib/location';
import { supabase } from '@/lib/supabase';
import type { Group, School } from '@/types/database';

export default function DriverHomeScreen() {
  const { profile } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [groupLoaded, setGroupLoaded] = useState(false);
  const [school, setSchool] = useState<School | null>(null);
  const [trackedSchoolId, setTrackedSchoolId] = useState(group?.school_id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Imperative handle for the GPS subscription, not display state.
  const stopTrackingRef = useRef<(() => void) | null>(null);

  const roster = useGroupRoster(group?.id);
  const { trip } = useActiveTrip(group?.id);
  const busLocation = useTripLocationSubscription(trip?.id);

  // Reset during render when the linked school changes, rather than in an effect.
  if (group?.school_id !== trackedSchoolId) {
    setTrackedSchoolId(group?.school_id);
    setSchool(null);
  }

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('groups')
      .select('*')
      .eq('driver_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        setGroup((data as Group) ?? null);
        setGroupLoaded(true);
      });
  }, [profile]);

  useEffect(() => {
    if (!group?.school_id) return;
    supabase
      .from('schools')
      .select('*')
      .eq('id', group.school_id)
      .single()
      .then(({ data }) => setSchool((data as School) ?? null));
  }, [group?.school_id]);

  // Resume GPS broadcast if a trip is already active (e.g. after an app restart).
  useEffect(() => {
    let cancelled = false;

    if (trip?.status === 'active' && !stopTrackingRef.current) {
      startTripTracking(trip.id, setError)
        .then((stop) => {
          if (cancelled) stop();
          else stopTrackingRef.current = stop;
        })
        .catch((e) => setError(e.message));
    } else if (trip?.status !== 'active' && stopTrackingRef.current) {
      stopTrackingRef.current();
      stopTrackingRef.current = null;
    }

    return () => {
      cancelled = true;
    };
  }, [trip]);

  // Stop tracking if the driver navigates away or the app is closed mid-trip.
  useEffect(() => () => stopTrackingRef.current?.(), []);

  const handleStart = useCallback(async () => {
    if (!group || !profile) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('trips')
      .insert({ group_id: group.id, driver_id: profile.id });
    setBusy(false);
    if (error) setError(error.message);
  }, [group, profile]);

  const handleEnd = useCallback(async () => {
    if (!trip) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('trips')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', trip.id);
    setBusy(false);
    if (error) setError(error.message);
  }, [trip]);

  function handleShare() {
    if (!group) return;
    Share.share({ message: `Join my Busgo group "${group.name}" with code ${group.join_code}` });
  }

  if (!groupLoaded) return null;

  if (!group) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <CreateGroupForm driverId={profile!.id} onCreated={setGroup} />
          <SignOutLink />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.header}>
          <ThemedView>
            <ThemedText type="subtitle">{group.name}</ThemedText>
            <Pressable onPress={handleShare}>
              <ThemedText type="link" themeColor="textSecondary">
                Code: {group.join_code} · Share
              </ThemedText>
            </Pressable>
          </ThemedView>
          <SignOutLink />
        </ThemedView>

        {group.school_id ? (
          school && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.schoolLine}>
              Linked to {school.name}
            </ThemedText>
          )
        ) : (
          <LinkSchoolRow groupId={group.id} onLinked={(s) => setSchool(s)} />
        )}

        <ThemedView style={styles.mapContainer}>
          <BusMap
            points={roster.map((s) => ({ id: s.id, lat: s.pickup_lat, lng: s.pickup_lng, name: s.full_name }))}
            busLocation={busLocation ? { latitude: busLocation.lat, longitude: busLocation.lng } : null}
          />
        </ThemedView>

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <ThemedView style={styles.footer}>
          <TripControls
            isActive={trip?.status === 'active'}
            busy={busy}
            onStart={handleStart}
            onEnd={handleEnd}
          />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

function LinkSchoolRow({ groupId, onLinked }: { groupId: string; onLinked: (school: School) => void }) {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLink() {
    setError(null);
    setLoading(true);
    const { error: rpcError } = await supabase.rpc('link_group_to_school', {
      p_group_id: groupId,
      p_school_code: code.trim(),
    });
    if (rpcError) {
      setLoading(false);
      setError(rpcError.message);
      return;
    }
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('join_code', code.trim().toUpperCase())
      .single();
    setLoading(false);
    if (school) onLinked(school as School);
  }

  return (
    <ThemedView style={styles.linkRow}>
      <TextInput
        style={[styles.linkInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="Link to a school (optional)"
        placeholderTextColor={theme.textSecondary}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
      />
      <Pressable onPress={handleLink} disabled={loading || !code.trim()} style={styles.linkButton}>
        {loading ? <ActivityIndicator color={theme.text} /> : <ThemedText type="smallBold">Link</ThemedText>}
      </Pressable>
      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}
    </ThemedView>
  );
}

function SignOutLink() {
  return (
    <Pressable onPress={() => supabase.auth.signOut()}>
      <ThemedText type="link" themeColor="textSecondary">
        Sign out
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  schoolLine: { paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  linkInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  linkButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  mapContainer: { flex: 1 },
  error: { textAlign: 'center', paddingHorizontal: Spacing.four },
  footer: { padding: Spacing.four },
});
