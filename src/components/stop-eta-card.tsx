import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { estimateEtaMinutes } from '@/lib/eta';
import type { Stop, TripLocation } from '@/types/database';

type Props = {
  stop: Stop;
  busLocation: TripLocation | null;
};

export function StopEtaCard({ stop, busLocation }: Props) {
  const etaMinutes = busLocation
    ? estimateEtaMinutes(
        { lat: busLocation.lat, lng: busLocation.lng },
        { lat: stop.lat, lng: stop.lng }
      )
    : null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        Your stop
      </ThemedText>
      <ThemedText type="subtitle">{stop.name}</ThemedText>
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
