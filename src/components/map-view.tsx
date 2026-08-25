import { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';

import type { Stop } from '@/types/database';

type Props = {
  stops: Stop[];
  busLocation: LatLng | null;
  highlightedStopId?: string;
};

export function BusMap({ stops, busLocation, highlightedStopId }: Props) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const points: LatLng[] = [
      ...stops.map((s) => ({ latitude: s.lat, longitude: s.lng })),
      ...(busLocation ? [busLocation] : []),
    ];
    if (points.length > 0) {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [stops, busLocation]);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}>
      {stops.map((stop) => (
        <Marker
          key={stop.id}
          coordinate={{ latitude: stop.lat, longitude: stop.lng }}
          title={stop.name}
          pinColor={stop.id === highlightedStopId ? '#208AEF' : undefined}
        />
      ))}
      {busLocation && (
        <Marker coordinate={busLocation} title="Bus" pinColor="#E63946" identifier="bus" />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
