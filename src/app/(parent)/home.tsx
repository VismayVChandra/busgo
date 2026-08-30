import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';

import { AbsenceToggle } from '@/components/absence-toggle';
import { BoardingStatusBadge } from '@/components/boarding-status-badge';
import { BroadcastBanner } from '@/components/broadcast-banner';
import { BusMap } from '@/components/map-view';
import { JoinGroupForm } from '@/components/join-group-form';
import { SignOutLink } from '@/components/sign-out-link';
import { StopEtaCard } from '@/components/stop-eta-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { useTripLocationSubscription } from '@/hooks/useTripLocationSubscription';
import { useAuth } from '@/lib/auth';
import { registerForPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { Student } from '@/types/database';

export default function ParentHomeScreen() {
  const theme = useTheme();
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
            {students.map((student) => {
              const selectedChip = student.id === selectedId;
              return (
                <Pressable
                  key={student.id}
                  onPress={() => setSelectedId(student.id)}
                  style={[
                    styles.childChip,
                    { borderColor: selectedChip ? theme.primary : theme.border },
                    selectedChip && { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <ThemedText type="smallBold" themeColor={selectedChip ? 'primary' : undefined}>
                    {student.full_name}
                  </ThemedText>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => router.push('/(parent)/join')}
              style={[styles.addChip, { borderColor: theme.border }]}>
              <Plus size={16} color={theme.primary} />
            </Pressable>
          </ThemedView>
          <SignOutLink />
        </ThemedView>

        {selected && <BroadcastBanner groupId={selected.group_id} />}

        <ThemedView style={styles.mapCard}>
          <ThemedView style={[styles.mapContainer, { borderColor: theme.border }, CardShadow]}>
            <BusMap
              points={
                selected
                  ? [{ id: selected.id, lat: selected.pickup_lat, lng: selected.pickup_lng, name: selected.full_name }]
                  : []
              }
              busLocation={busLocation ? { latitude: busLocation.lat, longitude: busLocation.lng } : null}
              highlightedPointId={selected?.id}
            />
          </ThemedView>
        </ThemedView>

        {selected && (
          <ThemedView style={styles.footer}>
            <StopEtaCard
              point={{ name: selected.full_name, lat: selected.pickup_lat, lng: selected.pickup_lng }}
              busLocation={busLocation}
            />
            <BoardingStatusBadge tripId={trip?.id} studentId={selected.id} />
            <ThemedView style={styles.absenceRow}>
              <AbsenceToggle studentId={selected.id} />
            </ThemedView>
          </ThemedView>
        )}
      </SafeAreaView>
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
  childRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', flex: 1, alignItems: 'center' },
  childChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  addChip: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCard: { flex: 1, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  mapContainer: { flex: 1, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  footer: { padding: Spacing.four, gap: Spacing.two },
  absenceRow: { alignItems: 'flex-start' },
});
