import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusMap } from '@/components/map-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripControls } from '@/components/trip-controls';
import { Spacing } from '@/constants/theme';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { useTripLocationSubscription } from '@/hooks/useTripLocationSubscription';
import { useAuth } from '@/lib/auth';
import { startTripTracking } from '@/lib/location';
import { supabase } from '@/lib/supabase';
import type { Bus, Route, Stop } from '@/types/database';

export default function DriverHomeScreen() {
  const { profile } = useAuth();
  const [bus, setBus] = useState<Bus | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Imperative handle for the GPS subscription, not display state.
  const stopTrackingRef = useRef<(() => void) | null>(null);

  const { trip } = useActiveTrip(route?.id);
  const busLocation = useTripLocationSubscription(trip?.id);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('buses')
      .select('*')
      .eq('driver_id', profile.id)
      .maybeSingle()
      .then(({ data }) => setBus((data as Bus) ?? null));
  }, [profile]);

  useEffect(() => {
    if (!bus) return;
    supabase
      .from('routes')
      .select('*')
      .eq('bus_id', bus.id)
      .maybeSingle()
      .then(({ data }) => setRoute((data as Route) ?? null));
  }, [bus]);

  useEffect(() => {
    if (!route) return;
    supabase
      .from('stops')
      .select('*')
      .eq('route_id', route.id)
      .order('sequence_order', { ascending: true })
      .then(({ data }) => setStops((data as Stop[]) ?? []));
  }, [route]);

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
    if (!route || !bus || !profile) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('trips')
      .insert({ route_id: route.id, bus_id: bus.id, driver_id: profile.id });
    setBusy(false);
    if (error) setError(error.message);
  }, [route, bus, profile]);

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

  if (!bus || !route) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
            No bus is assigned to your account yet. Ask an admin to assign you to a bus.
          </ThemedText>
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
            <ThemedText type="subtitle">{route.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {bus.name}
            </ThemedText>
          </ThemedView>
          <SignOutLink />
        </ThemedView>

        <ThemedView style={styles.mapContainer}>
          <BusMap
            stops={stops}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.three, padding: Spacing.four },
  centeredText: { textAlign: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  mapContainer: { flex: 1 },
  error: { textAlign: 'center', paddingHorizontal: Spacing.four },
  footer: { padding: Spacing.four },
});
