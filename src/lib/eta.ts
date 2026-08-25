const EARTH_RADIUS_KM = 6371;
const ASSUMED_AVERAGE_SPEED_KMH = 25;

export function haversineDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Straight-line ETA in minutes, good enough for an MVP notification threshold. */
export function estimateEtaMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  averageSpeedKmh: number = ASSUMED_AVERAGE_SPEED_KMH
): number {
  const distanceKm = haversineDistanceKm(from, to);
  return (distanceKm / averageSpeedKmh) * 60;
}
