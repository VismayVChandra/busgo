import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Share2 } from 'lucide-react-native';

import { BusMap } from '@/components/map-view';
import { CreateSchoolForm } from '@/components/create-school-form';
import { SignOutLink } from '@/components/sign-out-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSchoolFleet } from '@/hooks/useSchoolFleet';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { School } from '@/types/database';

export default function SchoolHomeScreen() {
  const theme = useTheme();
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
            <Pressable onPress={handleShare} style={styles.shareRow}>
              <Share2 size={13} color={theme.textSecondary} />
              <ThemedText type="link" themeColor="textSecondary">
                Code: {school.join_code} · Share
              </ThemedText>
            </Pressable>
          </ThemedView>
          <SignOutLink />
        </ThemedView>

        <ThemedView style={styles.mapCard}>
          <ThemedView style={[styles.mapContainer, { borderColor: theme.border }, CardShadow]}>
            <BusMap points={activePoints} busLocation={null} />
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.list}>
          {fleet.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No buses linked yet. Share your school code with drivers.
            </ThemedText>
          ) : (
            fleet.map((entry) => {
              const onTrip = !!entry.trip;
              return (
                <ThemedView
                  key={entry.group.id}
                  type="surface"
                  style={[styles.listRow, { borderColor: theme.border }, CardShadow]}>
                  <ThemedView
                    style={[styles.statusDot, { backgroundColor: onTrip ? theme.success : theme.textSecondary }]}
                  />
                  <ThemedView style={styles.listRowText}>
                    <ThemedText type="default">{entry.group.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {onTrip ? `On trip since ${new Date(entry.trip!.started_at).toLocaleTimeString()}` : 'Idle'}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              );
            })
          )}
        </ThemedView>
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
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.half },
  mapCard: { flex: 1, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  mapContainer: { flex: 1, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  list: { padding: Spacing.four, gap: Spacing.two },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: Radius.pill },
  listRowText: { gap: Spacing.half },
});
