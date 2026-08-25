import { StyleSheet } from 'react-native';
import type { LatLng } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Stop } from '@/types/database';

type Props = {
  stops: Stop[];
  busLocation: LatLng | null;
  highlightedStopId?: string;
};

// react-native-maps has no web implementation. Busgo ships native-only
// (Play Store / App Store); this stands in for local web dev/testing only.
export function BusMap({ stops, busLocation, highlightedStopId }: Props) {
  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
        Map preview isn't available on web — run the app on Android/iOS to see it.
      </ThemedText>
      {busLocation && (
        <ThemedText type="small">
          Bus at {busLocation.latitude.toFixed(4)}, {busLocation.longitude.toFixed(4)}
        </ThemedText>
      )}
      {stops.map((stop) => (
        <ThemedText key={stop.id} type={stop.id === highlightedStopId ? 'smallBold' : 'small'}>
          {stop.sequence_order}. {stop.name}
        </ThemedText>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.two },
  notice: { marginBottom: Spacing.two },
});
