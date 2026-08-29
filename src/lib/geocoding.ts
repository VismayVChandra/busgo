export type GeocodeResult = { lat: number; lng: number; label: string };

/**
 * Free-text address search via OpenStreetMap's Nominatim, matching the rest
 * of the map stack (no API key, no billing). Nominatim's usage policy asks
 * for a distinctive User-Agent and no bulk/automated querying — fine for a
 * one-off manual search here, but not something to call in a loop.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Busgo school-van tracking app (contact via app store listing)' },
  });
  if (!response.ok) {
    throw new Error('Could not search for that address right now');
  }

  const results = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  return results.map((r) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: r.display_name }));
}
