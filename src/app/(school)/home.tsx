import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusMap } from '@/components/map-view';
import { CreateSchoolForm } from '@/components/create-school-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSchoolFleet } from '@/hooks/useSchoolFleet';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { School } from '@/types/database';

export default function SchoolHomeScreen() {
  const { profile } = useAuth();
  const [school, setSchool] = useState<School | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fleet = useSchoolFleet(school?.id);
  const activePoints = fleet
    .filter((entry) => entry.trip && entry.location)
    .map((entry) => ({
      id: entry.group.id,
      lat: entry.location!.lat,
      lng: entry.location!.lng,
      name: entry.group.name,
    }));

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('schools')
      .select('*')
      .eq('owner_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        setSchool((data as School) ?? null);
        setLoaded(true);
      });
  }, [profile]);

  function handleShare() {
    if (!school) return;
    Share.share({ message: `Join "${school.name}" on Busgo with code ${school.join_code}` });
  }

  if (!loaded) return null;

  if (!school) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <CreateSchoolForm ownerId={profile!.id} onCreated={setSchool} />
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
            <ThemedText type="subtitle">{school.name}</ThemedText>
            <Pressable onPress={handleShare}>
              <ThemedText type="link" themeColor="textSecondary">
                Code: {school.join_code} · Share
              </ThemedText>
            </Pressable>
          </ThemedView>
          <SignOutLink />
        </ThemedView>

        <ThemedView style={styles.mapContainer}>
          <BusMap points={activePoints} busLocation={null} />
        </ThemedView>

        <ThemedView style={styles.list}>
          {fleet.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No buses linked yet. Share your school code with drivers.
            </ThemedText>
          ) : (
            fleet.map((entry) => (
              <ThemedView key={entry.group.id} type="backgroundElement" style={styles.listRow}>
                <ThemedText type="default">{entry.group.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {entry.trip
                    ? `On trip since ${new Date(entry.trip.started_at).toLocaleTimeString()}`
                    : 'Idle'}
                </ThemedText>
              </ThemedView>
            ))
          )}
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
  centered: { flex: 1, justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  mapContainer: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.two },
  listRow: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
});
