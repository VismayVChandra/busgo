import { StyleSheet } from 'react-native';
import { Clock, MapPin } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { estimateEtaMinutes } from '@/lib/eta';
import type { TripLocation } from '@/types/database';

type Props = {
  point: { name: string; lat: number; lng: number };
  busLocation: TripLocation | null;
};

export function StopEtaCard({ point, busLocation }: Props) {
  const theme = useTheme();
  const etaMinutes = busLocation
    ? estimateEtaMinutes(
        { lat: busLocation.lat, lng: busLocation.lng },
        { lat: point.lat, lng: point.lng }
      )
    : null;

  return (
    <ThemedView type="surface" style={[styles.card, { borderColor: theme.border }, CardShadow]}>
      <ThemedView style={styles.header}>
        <MapPin size={14} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          Your pickup point
        </ThemedText>
      </ThemedView>
      <ThemedText type="subtitle">{point.name}</ThemedText>
      <ThemedView style={styles.etaRow}>
        <Clock size={16} color={etaMinutes === null ? theme.textSecondary : theme.primary} />
        {etaMinutes === null ? (
          <ThemedText type="default" themeColor="textSecondary">
            No active trip right now
          </ThemedText>
        ) : (
          <ThemedText style={[styles.etaText, { color: theme.primary }]}>
            {etaMinutes < 1 ? 'Arriving now' : `~${Math.round(etaMinutes)} min away`}
          </ThemedText>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.two,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  etaText: { fontFamily: Fonts.displaySemiBold, fontSize: 22, lineHeight: 28 },
});
