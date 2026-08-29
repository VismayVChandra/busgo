import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Group, Trip } from '@/types/database';

export default function AdminHomeScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);

  useEffect(() => {
    supabase.from('groups').select('*').then(({ data }) => setGroups((data as Group[]) ?? []));
    supabase
      .from('trips')
      .select('*')
      .eq('status', 'active')
      .then(({ data }) => setActiveTrips((data as Trip[]) ?? []));
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">Admin</ThemedText>
          <Pressable onPress={() => supabase.auth.signOut()}>
            <ThemedText type="link" themeColor="textSecondary">
              Sign out
            </ThemedText>
          </Pressable>
        </ThemedView>

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary">
            Schools, groups, and students are all self-service now (join codes) — this view is a
            read-only overview for spot-checking, not a management screen.
          </ThemedText>

          <Section title={`Groups (${groups.length})`}>
            {groups.map((group) => (
              <ThemedText key={group.id} type="default">
                {group.name}
              </ThemedText>
            ))}
          </Section>

          <Section title={`Active trips (${activeTrips.length})`}>
            {activeTrips.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No buses are currently on a trip.
              </ThemedText>
            ) : (
              activeTrips.map((trip) => (
                <ThemedText key={trip.id} type="default">
                  Trip started {new Date(trip.started_at).toLocaleTimeString()}
                </ThemedText>
              ))
            )}
          </Section>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedView style={styles.sectionBody}>{children}</ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  content: { padding: Spacing.four, gap: Spacing.three },
  section: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  sectionBody: { gap: Spacing.one },
});
