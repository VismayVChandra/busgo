import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { MapPoint } from '@/types/database';

type Props = {
  points: MapPoint[];
  busLocation: { latitude: number; longitude: number } | null;
  highlightedPointId?: string;
};

// react-native-webview has no web implementation either. Busgo ships
// native-only (Play Store / App Store); this stands in for local web dev/testing only.
export function BusMap({ points, busLocation, highlightedPointId }: Props) {
  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
        Map preview isn&apos;t available on web — run the app on Android/iOS to see it.
      </ThemedText>
      {busLocation && (
        <ThemedText type="small">
          Bus at {busLocation.latitude.toFixed(4)}, {busLocation.longitude.toFixed(4)}
        </ThemedText>
      )}
      {points.map((point) => (
        <ThemedText key={point.id} type={point.id === highlightedPointId ? 'smallBold' : 'small'}>
          {point.name}
        </ThemedText>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, gap: Spacing.two },
  notice: { marginBottom: Spacing.two },
});
