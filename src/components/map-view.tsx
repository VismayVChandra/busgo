import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';

import type { MapPoint } from '@/types/database';

type LatLng = { latitude: number; longitude: number };

type Props = {
  points: MapPoint[];
  busLocation: LatLng | null;
  highlightedPointId?: string;
};

type MapData = {
  points: { id: string; lat: number; lng: number; name: string; highlighted: boolean }[];
  bus: { lat: number; lng: number } | null;
};

function toMapData({ points, busLocation, highlightedPointId }: Props): MapData {
  return {
    points: points.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      name: p.name,
      highlighted: p.id === highlightedPointId,
    })),
    bus: busLocation ? { lat: busLocation.latitude, lng: busLocation.longitude } : null,
  };
}

// Static shell loaded once; live data is pushed in afterwards via injectJavaScript
// so panning/zoom state survives marker updates instead of reloading the page.
const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .point-icon { background: #208AEF; border: 2px solid white; border-radius: 50%; width: 14px; height: 14px; }
    .point-icon.highlighted { background: #E63946; width: 18px; height: 18px; }
    .bus-icon { background: #111; border: 2px solid white; border-radius: 50%; width: 20px; height: 20px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    map.setView([0, 0], 2);

    var pointMarkers = [];
    var busMarker = null;

    function makeIcon(className, size) {
      return L.divIcon({ className: '', html: '<div class="' + className + '"></div>', iconSize: [size, size] });
    }

    window.updateMap = function (data) {
      pointMarkers.forEach(function (m) { map.removeLayer(m); });
      pointMarkers = [];

      var bounds = [];
      data.points.forEach(function (p) {
        var icon = makeIcon(p.highlighted ? 'point-icon highlighted' : 'point-icon', p.highlighted ? 18 : 14);
        var marker = L.marker([p.lat, p.lng], { icon: icon }).bindPopup(p.name);
        marker.addTo(map);
        pointMarkers.push(marker);
        bounds.push([p.lat, p.lng]);
      });

      if (data.bus) {
        var busIcon = makeIcon('bus-icon', 20);
        if (busMarker) {
          busMarker.setLatLng([data.bus.lat, data.bus.lng]);
        } else {
          busMarker = L.marker([data.bus.lat, data.bus.lng], { icon: busIcon }).bindPopup('Bus');
          busMarker.addTo(map);
        }
        bounds.push([data.bus.lat, data.bus.lng]);
      } else if (busMarker) {
        map.removeLayer(busMarker);
        busMarker = null;
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    };
  </script>
</body>
</html>`;

export function BusMap(props: Props) {
  const webviewRef = useRef<WebView>(null);
  const initialData = useRef(toMapData(props)).current;

  useEffect(() => {
    const data = toMapData(props);
    webviewRef.current?.injectJavaScript(`window.updateMap(${JSON.stringify(data)}); true;`);
  }, [props.points, props.busLocation, props.highlightedPointId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WebView
      ref={webviewRef}
      style={styles.map}
      originWhitelist={['*']}
      source={{ html: HTML }}
      onLoadEnd={() => webviewRef.current?.injectJavaScript(`window.updateMap(${JSON.stringify(initialData)}); true;`)}
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
