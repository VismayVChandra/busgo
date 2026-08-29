import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { estimateEtaMinutes } from '@/lib/eta';
import type { TripLocation } from '@/types/database';

type Props = {
  point: { name: string; lat: number; lng: number };
  busLocation: TripLocation | null;
};

export function StopEtaCard({ point, busLocation }: Props) {
  const etaMinutes = busLocation
    ? estimateEtaMinutes(
        { lat: busLocation.lat, lng: busLocation.lng },
        { lat: point.lat, lng: point.lng }
      )
    : null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        Your pickup point
      </ThemedText>
      <ThemedText type="subtitle">{point.name}</ThemedText>
      {etaMinutes === null ? (
        <ThemedText type="default" themeColor="textSecondary">
          No active trip right now
        </ThemedText>
      ) : (
        <ThemedText type="default">
          {etaMinutes < 1 ? 'Arriving now' : `~${Math.round(etaMinutes)} min away`}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
});
