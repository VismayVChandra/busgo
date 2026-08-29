import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { BusMap } from '@/components/map-view';
import { JoinGroupForm } from '@/components/join-group-form';
import { StopEtaCard } from '@/components/stop-eta-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { useTripLocationSubscription } from '@/hooks/useTripLocationSubscription';
import { useAuth } from '@/lib/auth';
import { registerForPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { Student } from '@/types/database';

export default function ParentHomeScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = students.find((s) => s.id === selectedId) ?? null;

  const { trip } = useActiveTrip(selected?.group_id);
  const busLocation = useTripLocationSubscription(trip?.id);

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  function loadStudents() {
    if (!profile) return;
    supabase
      .from('students')
      .select('*')
      .eq('parent_id', profile.id)
      .then(({ data }) => {
        const list = (data as Student[]) ?? [];
        setStudents(list);
        setSelectedId((current) => current ?? list[0]?.id ?? null);
        setLoaded(true);
      });
  }

  useEffect(loadStudents, [profile]);

  if (!loaded) return null;

  if (students.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <JoinGroupForm onJoined={loadStudents} />
          <SignOutLink />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.header}>
          <ThemedView style={styles.childRow}>
            {students.map((student) => (
              <Pressable
                key={student.id}
                onPress={() => setSelectedId(student.id)}
                style={[styles.childChip, student.id === selectedId && styles.childChipSelected]}>
                <ThemedText type="smallBold">{student.full_name}</ThemedText>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push('/(parent)/join')} style={styles.addChip}>
              <ThemedText type="smallBold">+</ThemedText>
            </Pressable>
          </ThemedView>
          <SignOutLink />
        </ThemedView>

        <ThemedView style={styles.mapContainer}>
          <BusMap
            points={
              selected ? [{ id: selected.id, lat: selected.pickup_lat, lng: selected.pickup_lng, name: selected.full_name }] : []
            }
            busLocation={busLocation ? { latitude: busLocation.lat, longitude: busLocation.lng } : null}
            highlightedPointId={selected?.id}
          />
        </ThemedView>

        {selected && (
          <ThemedView style={styles.footer}>
            <StopEtaCard
              point={{ name: selected.full_name, lat: selected.pickup_lat, lng: selected.pickup_lng }}
              busLocation={busLocation}
            />
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
  centered: { flex: 1, justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  childRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', flex: 1, alignItems: 'center' },
  childChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
    borderWidth: 1,
    borderColor: '#B0B4BA',
  },
  childChipSelected: { backgroundColor: '#E0E1E6' },
  addChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B0B4BA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: { flex: 1 },
  footer: { padding: Spacing.four },
});
