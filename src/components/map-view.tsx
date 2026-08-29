import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';

import type { MapPoint } from '@/types/database';

type LatLng = { latitude: number; longitude: number };

type Props = {
  points: MapPoint[];
  busLocation: LatLng | null;
  highlightedPointId?: string;
  /** Draws a numbered path through `points` in the given order, from `routeStart` if set. */
  showRoute?: boolean;
  routeStart?: LatLng;
};

type MapData = {
  points: { id: string; lat: number; lng: number; name: string; highlighted: boolean; sequence: number | null }[];
  bus: { lat: number; lng: number } | null;
  route: { lat: number; lng: number }[] | null;
};

function toMapData({ points, busLocation, highlightedPointId, showRoute, routeStart }: Props): MapData {
  return {
    points: points.map((p, index) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      name: p.name,
      highlighted: p.id === highlightedPointId,
      sequence: showRoute ? index + 1 : null,
    })),
    bus: busLocation ? { lat: busLocation.latitude, lng: busLocation.longitude } : null,
    route: showRoute
      ? [
          ...(routeStart ? [{ lat: routeStart.latitude, lng: routeStart.longitude }] : []),
          ...points.map((p) => ({ lat: p.lat, lng: p.lng })),
        ]
      : null,
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
    .point-icon { background: #17666B; border: 2px solid #F9F6EC; border-radius: 50%; width: 14px; height: 14px; }
    .point-icon.highlighted { background: #E8A936; width: 18px; height: 18px; }
    .bus-icon {
      background: #17666B; border: 2px solid #F9F6EC; border-radius: 50%; width: 26px; height: 26px;
      display: flex; align-items: center; justify-content: center;
    }
    .sequence-icon {
      background: #17666B; color: #F9F6EC; border: 2px solid #F9F6EC; border-radius: 50%;
      width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
      font-family: sans-serif; font-size: 12px; font-weight: bold;
    }
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
    var routeLine = null;

    function makeIcon(className, size) {
      return L.divIcon({ className: '', html: '<div class="' + className + '"></div>', iconSize: [size, size] });
    }

    function makeSequenceIcon(n) {
      return L.divIcon({ className: '', html: '<div class="sequence-icon">' + n + '</div>', iconSize: [22, 22] });
    }

    var busSvg =
      '<svg width="14" height="14" viewBox="-16 -16 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M-11 8 V-5 a5 5 0 0 1 5-5h12a5 5 0 0 1 5 5V8M-15 1h30M-8 5h.01M8 5h.01" ' +
      'stroke="#F9F6EC" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

    function makeBusIcon() {
      return L.divIcon({ className: '', html: '<div class="bus-icon">' + busSvg + '</div>', iconSize: [26, 26] });
    }

    window.updateMap = function (data) {
      pointMarkers.forEach(function (m) { map.removeLayer(m); });
      pointMarkers = [];

      var bounds = [];
      data.points.forEach(function (p) {
        var icon = p.sequence
          ? makeSequenceIcon(p.sequence)
          : makeIcon(p.highlighted ? 'point-icon highlighted' : 'point-icon', p.highlighted ? 18 : 14);
        var marker = L.marker([p.lat, p.lng], { icon: icon }).bindPopup(p.name);
        marker.addTo(map);
        pointMarkers.push(marker);
        bounds.push([p.lat, p.lng]);
      });

      if (data.bus) {
        var busIcon = makeBusIcon();
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

      if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
      }
      if (data.route && data.route.length > 1) {
        routeLine = L.polyline(data.route.map(function (p) { return [p.lat, p.lng]; }), {
          color: '#17666B', weight: 3, dashArray: '6 6',
        }).addTo(map);
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
  }, [props.points, props.busLocation, props.highlightedPointId, props.showRoute, props.routeStart]); // eslint-disable-line react-hooks/exhaustive-deps

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
