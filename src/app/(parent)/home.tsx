import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusMap } from '@/components/map-view';
import { StopEtaCard } from '@/components/stop-eta-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { useTripLocationSubscription } from '@/hooks/useTripLocationSubscription';
import { useAuth } from '@/lib/auth';
import { registerForPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { Stop, Student } from '@/types/database';

export default function ParentHomeScreen() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);

  const selected = students.find((s) => s.id === selectedId) ?? null;
  const selectedStop = stops.find((s) => s.id === selected?.stop_id) ?? null;

  const { trip } = useActiveTrip(selected?.route_id);
  const busLocation = useTripLocationSubscription(trip?.id);

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('students')
      .select('*')
      .eq('parent_id', profile.id)
      .then(({ data }) => {
        const list = (data as Student[]) ?? [];
        setStudents(list);
        setSelectedId((current) => current ?? list[0]?.id ?? null);
      });
  }, [profile]);

  useEffect(() => {
    if (!selected) return;
    supabase
      .from('stops')
      .select('*')
      .eq('route_id', selected.route_id)
      .order('sequence_order', { ascending: true })
      .then(({ data }) => setStops((data as Stop[]) ?? []));
  }, [selected]);

  if (students.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centeredText}>
            No children are linked to your account yet. Ask an admin to add your child.
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
          {students.length > 1 ? (
            <ThemedView style={styles.childRow}>
              {students.map((student) => (
                <Pressable
                  key={student.id}
                  onPress={() => setSelectedId(student.id)}
                  style={[styles.childChip, student.id === selectedId && styles.childChipSelected]}>
                  <ThemedText type="smallBold">{student.full_name}</ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          ) : (
            <ThemedText type="subtitle">{selected?.full_name}</ThemedText>
          )}
          <SignOutLink />
        </ThemedView>

        <ThemedView style={styles.mapContainer}>
          <BusMap
            stops={stops}
            busLocation={busLocation ? { latitude: busLocation.lat, longitude: busLocation.lng } : null}
            highlightedStopId={selectedStop?.id}
          />
        </ThemedView>

        {selectedStop && (
          <ThemedView style={styles.footer}>
            <StopEtaCard stop={selectedStop} busLocation={busLocation} />
          </ThemedView>
        )}
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
  childRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', flex: 1 },
  childChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
    borderWidth: 1,
    borderColor: '#B0B4BA',
  },
  childChipSelected: { backgroundColor: '#E0E1E6' },
  mapContainer: { flex: 1 },
  footer: { padding: Spacing.four },
});
