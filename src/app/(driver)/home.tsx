import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Route as RouteIcon, Share2 } from 'lucide-react-native';

import { BoardingRoster } from '@/components/boarding-roster';
import { BroadcastComposer } from '@/components/broadcast-composer';
import { CreateGroupForm } from '@/components/create-group-form';
import { DriverVerificationStatus } from '@/components/driver-verification-status';
import { BusMap } from '@/components/map-view';
import { SignOutLink } from '@/components/sign-out-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { useGroupRoster } from '@/hooks/useGroupRoster';
import { useTodayAbsences } from '@/hooks/useTodayAbsences';
import { useTripLocationSubscription } from '@/hooks/useTripLocationSubscription';
import { TripControls } from '@/components/trip-controls';
import { useAuth } from '@/lib/auth';
import { getCurrentLocation, startTripTracking } from '@/lib/location';
import { registerForPushNotifications } from '@/lib/notifications';
import { optimizeRouteOrder } from '@/lib/routing';
import { supabase } from '@/lib/supabase';
import type { Group, School, Student } from '@/types/database';

export default function DriverHomeScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [groupLoaded, setGroupLoaded] = useState(false);
  const [school, setSchool] = useState<School | null>(null);
  const [trackedSchoolId, setTrackedSchoolId] = useState(group?.school_id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeStart, setRouteStart] = useState<{ latitude: number; longitude: number } | null>(null);
  const [orderedRoster, setOrderedRoster] = useState<Student[] | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  // Imperative handle for the GPS subscription, not display state.
  const stopTrackingRef = useRef<(() => void) | null>(null);

  const roster = useGroupRoster(group?.id);
  const { trip } = useActiveTrip(group?.id);
  const busLocation = useTripLocationSubscription(trip?.id);
  const absentIds = useTodayAbsences(group?.id);
  const activeRoster = roster.filter((s) => !absentIds.has(s.id));
  const displayRoster = orderedRoster ?? activeRoster;

  const rosterKey = activeRoster.map((s) => s.id).sort().join(',');
  const [trackedRosterKey, setTrackedRosterKey] = useState(rosterKey);
  // A newly joined (or removed) student invalidates any previously computed
  // route order — reset during render, rather than in an effect.
  if (rosterKey !== trackedRosterKey) {
    setTrackedRosterKey(rosterKey);
    if (orderedRoster) {
      setOrderedRoster(null);
      setRouteStart(null);
    }
  }

  async function handleOptimizeRoute() {
    setError(null);
    setOptimizing(true);
    try {
      const start = await getCurrentLocation();
      setRouteStart({ latitude: start.lat, longitude: start.lng });
      const points = activeRoster.map((s) => ({ id: s.id, lat: s.pickup_lat, lng: s.pickup_lng }));
      const ordered = optimizeRouteOrder({ lat: start.lat, lng: start.lng }, points);
      const rosterById = new Map(activeRoster.map((s) => [s.id, s]));
      setOrderedRoster(ordered.map((p) => rosterById.get(p.id)!));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get your location');
    } finally {
      setOptimizing(false);
    }
  }

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

  useEffect(() => {
    registerForPushNotifications();
  }, []);

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
            <Pressable onPress={handleShare} style={styles.shareRow}>
              <Share2 size={13} color={theme.textSecondary} />
              <ThemedText type="link" themeColor="textSecondary">
                Code: {group.join_code} · Share
              </ThemedText>
            </Pressable>
            {group.verification_status === 'verified' && (
              <DriverVerificationStatus group={group} school={school} />
            )}
          </ThemedView>
          <SignOutLink />
        </ThemedView>

        {group.verification_status !== 'verified' && (
          <DriverVerificationStatus group={group} school={school} />
        )}

        {group.school_id ? (
          school && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.schoolLine}>
              Linked to {school.name}
            </ThemedText>
          )
        ) : (
          <LinkSchoolRow groupId={group.id} onLinked={(s) => setSchool(s)} />
        )}

        <BroadcastComposer groupId={group.id} />

        {activeRoster.length > 1 && (
          <ThemedView style={styles.optimizeRow}>
            <Button
              label={orderedRoster ? 'Re-optimize route' : 'Optimize pickup route'}
              onPress={handleOptimizeRoute}
              loading={optimizing}
              variant="outline"
              icon={<RouteIcon size={16} color={theme.primary} />}
            />
          </ThemedView>
        )}

        <ThemedView style={styles.mapCard}>
          <ThemedView style={[styles.mapContainer, { borderColor: theme.border }, CardShadow]}>
            <BusMap
              points={displayRoster.map((s) => ({ id: s.id, lat: s.pickup_lat, lng: s.pickup_lng, name: s.full_name }))}
              busLocation={busLocation ? { latitude: busLocation.lat, longitude: busLocation.lng } : null}
              showRoute={!!orderedRoster}
              routeStart={routeStart ?? undefined}
            />
          </ThemedView>
        </ThemedView>

        <BoardingRoster
          roster={displayRoster}
          ordered={!!orderedRoster}
          tripId={trip?.id}
          tripActive={trip?.status === 'active'}
        />

        {error && (
          <ThemedText type="small" themeColor="error" style={styles.error}>
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
    <ThemedView style={styles.linkOuter}>
      <ThemedView style={styles.linkRow}>
        <TextField
          containerStyle={styles.linkInput}
          placeholder="Link to a school (optional)"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
        />
        <Button label="Link" onPress={handleLink} loading={loading} disabled={!code.trim()} variant="outline" style={styles.linkButton} />
      </ThemedView>
      {error && (
        <ThemedText type="small" themeColor="error" style={styles.error}>
          {error}
        </ThemedText>
      )}
    </ThemedView>
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
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.half },
  schoolLine: { paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  linkOuter: { paddingHorizontal: Spacing.four, marginBottom: Spacing.two, gap: Spacing.one },
  linkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  linkInput: { flex: 1 },
  linkButton: { paddingHorizontal: Spacing.three },
  optimizeRow: { paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  mapCard: { flex: 1, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  mapContainer: { flex: 1, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  error: { textAlign: 'center', paddingHorizontal: Spacing.four },
  footer: { padding: Spacing.four },
});
