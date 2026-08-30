import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Eye, X } from 'lucide-react-native';

import { SignOutLink } from '@/components/sign-out-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Group, Trip } from '@/types/database';

type PendingDriver = { group: Group; driverName: string | null };

export default function AdminHomeScreen() {
  const theme = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<PendingDriver[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function loadPendingDrivers() {
    supabase
      .from('groups')
      .select('*')
      .is('school_id', null)
      .eq('verification_status', 'pending')
      .not('id_document_path', 'is', null)
      .then(async ({ data }) => {
        const pending = (data as Group[]) ?? [];
        if (pending.length === 0) {
          setPendingDrivers([]);
          return;
        }
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', pending.map((g) => g.driver_id));
        const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
        setPendingDrivers(pending.map((group) => ({ group, driverName: nameById.get(group.driver_id) ?? null })));
      });
  }

  useEffect(() => {
    supabase.from('groups').select('*').then(({ data }) => setGroups((data as Group[]) ?? []));
    supabase
      .from('trips')
      .select('*')
      .eq('status', 'active')
      .then(({ data }) => setActiveTrips((data as Trip[]) ?? []));
    loadPendingDrivers();
  }, []);

  async function handleView(group: Group) {
    if (!group.id_document_path) return;
    const { data } = await supabase.storage.from('driver-documents').createSignedUrl(group.id_document_path, 300);
    if (data?.signedUrl) setPreviewUrl(data.signedUrl);
  }

  async function handleDecision(groupId: string, approve: boolean) {
    await supabase.rpc('review_independent_driver', { p_group_id: groupId, p_approve: approve });
    setPendingDrivers((current) => current.filter((p) => p.group.id !== groupId));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">Admin</ThemedText>
          <SignOutLink />
        </ThemedView>

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary">
            Schools, groups, and students are all self-service now (join codes) — this view is a
            read-only overview for spot-checking, not a management screen.
          </ThemedText>

          <Section title={`Independent drivers pending review (${pendingDrivers.length})`} borderColor={theme.border}>
            {pendingDrivers.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No documents waiting for review.
              </ThemedText>
            ) : (
              pendingDrivers.map(({ group, driverName }) => (
                <ThemedView key={group.id} style={[styles.driverRow, { borderColor: theme.border }, CardShadow]}>
                  <ThemedView style={styles.driverInfo}>
                    <ThemedText type="default">{group.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {driverName ?? 'Unknown driver'}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.driverActions}>
                    <Pressable onPress={() => handleView(group)} hitSlop={8} style={styles.iconButton}>
                      <Eye size={16} color={theme.primary} />
                    </Pressable>
                    <Button
                      label="Approve"
                      onPress={() => handleDecision(group.id, true)}
                      variant="outline"
                      icon={<Check size={14} color={theme.success} />}
                      style={styles.actionButton}
                    />
                    <Button
                      label="Reject"
                      onPress={() => handleDecision(group.id, false)}
                      variant="outline"
                      icon={<X size={14} color={theme.error} />}
                      style={styles.actionButton}
                    />
                  </ThemedView>
                </ThemedView>
              ))
            )}
          </Section>

          <Section title={`Groups (${groups.length})`} borderColor={theme.border}>
            {groups.map((group) => (
              <ThemedText key={group.id} type="default">
                {group.name}
              </ThemedText>
            ))}
          </Section>

          <Section title={`Active trips (${activeTrips.length})`} borderColor={theme.border}>
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

        <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPreviewUrl(null)}>
            {previewUrl && <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />}
          </Pressable>
        </Modal>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({ title, borderColor, children }: { title: string; borderColor: string; children: React.ReactNode }) {
  return (
    <ThemedView style={[styles.section, { borderColor }]}>
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
  section: { padding: Spacing.three, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.two },
  sectionBody: { gap: Spacing.two },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.two,
  },
  driverInfo: { flex: 1, gap: Spacing.half },
  driverActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  iconButton: { padding: Spacing.one },
  actionButton: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '90%', height: '80%' },
});
