import { haversineDistanceKm } from '@/lib/eta';

type LatLng = { lat: number; lng: number };
type RoutablePoint = LatLng & { id: string };

const MAX_SEEDS = 6;

/**
 * Orders stops into a short visiting route starting from `start` (the
 * driver's current location) — no fixed end point, just an efficient path
 * through every stop. Straight-line distance, not road distance — see plan
 * doc for why (avoids a paid routing API / the Google Cloud billing
 * friction we already hit once).
 *
 * Multi-start nearest-neighbor + 2-opt/Or-opt local search: a single
 * nearest-neighbor seed reliably gets stuck in a local optimum that no
 * single reversal or relocation can escape (confirmed while testing this
 * against a manually-reasoned better route — 2-opt alone landed ~15%
 * longer). Trying a handful of different starting seeds and keeping the
 * shortest result found is the standard fix and stays well under 500ms
 * even at 50 stops, far past realistic van capacity.
 */
export function optimizeRouteOrder<T extends RoutablePoint>(start: LatLng, points: T[]): T[] {
  if (points.length <= 1) return [...points];

  const seedCount = Math.min(points.length, MAX_SEEDS);
  let best: T[] | null = null;
  let bestDistance = Infinity;

  for (let seedIndex = 0; seedIndex < seedCount; seedIndex++) {
    const seeded = nearestNeighborFrom(start, points, seedIndex);
    const improved = localSearch(start, seeded);
    const distance = routeDistanceKm(start, improved);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = improved;
    }
  }

  return best!;
}

function routeDistanceKm(start: LatLng, points: LatLng[]): number {
  let total = 0;
  let current = start;
  for (const point of points) {
    total += haversineDistanceKm(current, point);
    current = point;
  }
  return total;
}

/** Nearest-neighbor, but forcing `points[firstIndex]` to be visited first — gives each seed a different shape. */
function nearestNeighborFrom<T extends RoutablePoint>(start: LatLng, points: T[], firstIndex: number): T[] {
  const remaining = [...points];
  const ordered: T[] = [];
  let current: LatLng = start;

  const [first] = remaining.splice(firstIndex, 1);
  ordered.push(first);
  current = first;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    remaining.forEach((point, index) => {
      const distance = haversineDistanceKm(current, point);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    const [next] = remaining.splice(nearestIndex, 1);
    ordered.push(next);
    current = next;
  }

  return ordered;
}

/** Alternates 2-opt and Or-opt passes until neither improves the route further. */
function localSearch<T extends LatLng>(start: LatLng, initial: T[]): T[] {
  let route = initial;
  let changed = true;
  while (changed) {
    const before = routeDistanceKm(start, route);
    route = twoOptPass(start, route);
    route = orOptPass(start, route);
    changed = routeDistanceKm(start, route) < before - 1e-9;
  }
  return route;
}

/** Reverses segments when doing so shortens the route; restarts the scan after every improving move. */
function twoOptPass<T extends LatLng>(start: LatLng, initial: T[]): T[] {
  let route = initial;
  let improvedAny = true;

  while (improvedAny) {
    improvedAny = false;
    outer: for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const candidate = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)];
        if (routeDistanceKm(start, candidate) < routeDistanceKm(start, route)) {
          route = candidate;
          improvedAny = true;
          break outer;
        }
      }
    }
  }

  return route;
}

/** Relocates a single stop to a better position — catches cases a segment reversal alone can't fix. */
function orOptPass<T extends LatLng>(start: LatLng, initial: T[]): T[] {
  let route = initial;
  let improvedAny = true;

  while (improvedAny) {
    improvedAny = false;
    outer: for (let i = 0; i < route.length; i++) {
      const item = route[i];
      const withoutItem = [...route.slice(0, i), ...route.slice(i + 1)];
      for (let j = 0; j <= withoutItem.length; j++) {
        if (j === i) continue; // reinserting at the same spot reproduces the original route
        const candidate = [...withoutItem.slice(0, j), item, ...withoutItem.slice(j)];
        if (routeDistanceKm(start, candidate) < routeDistanceKm(start, route)) {
          route = candidate;
          improvedAny = true;
          break outer;
        }
      }
    }
  }

  return route;
}
