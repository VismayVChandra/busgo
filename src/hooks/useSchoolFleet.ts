import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Group, Trip, TripLocation } from '@/types/database';

export type FleetEntry = {
  group: Group;
  trip: Trip | null;
  location: TripLocation | null;
};

/** Live status + location of every group linked to a school. */
export function useSchoolFleet(schoolId: string | null | undefined) {
  const [fleet, setFleet] = useState<FleetEntry[]>([]);
  const [trackedSchoolId, setTrackedSchoolId] = useState(schoolId);

  // Reset during render when schoolId changes, rather than in an effect.
  if (schoolId !== trackedSchoolId) {
    setTrackedSchoolId(schoolId);
    setFleet([]);
  }

  useEffect(() => {
    if (!schoolId) return;

    let cancelled = false;

    async function load() {
      const { data: groups } = await supabase.from('groups').select('*').eq('school_id', schoolId);
      const groupList = (groups as Group[]) ?? [];
      if (groupList.length === 0) {
        if (!cancelled) setFleet([]);
        return;
      }

      const groupIds = groupList.map((g) => g.id);
      const { data: trips } = await supabase
        .from('trips')
        .select('*')
        .in('group_id', groupIds)
        .eq('status', 'active');
      const tripByGroupId = new Map((trips as Trip[] | null)?.map((t) => [t.group_id, t]) ?? []);

      const entries: FleetEntry[] = [];
      for (const group of groupList) {
        const trip = tripByGroupId.get(group.id) ?? null;
        let location: TripLocation | null = null;
        if (trip) {
          const { data: latest } = await supabase
            .from('trip_locations')
            .select('*')
            .eq('trip_id', trip.id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          location = (latest as TripLocation) ?? null;
        }
        entries.push({ group, trip, location });
      }

      if (!cancelled) setFleet(entries);
    }

    load();

    // No column filter on either subscription: postgres_changes filters only
    // support a single column=eq.value and can't express "trip_id in this
    // dynamic list." RLS still scopes delivered rows to this school's own
    // fleet, so an unfiltered subscription is safe here.
    const tripsChannel = supabase
      .channel(`school_fleet_trips:${schoolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (payload) => {
        const row = payload.new as Trip;
        setFleet((current) =>
          current.map((entry) =>
            entry.group.id === row.group_id
              ? { ...entry, trip: row.status === 'active' ? row : null, location: row.status === 'active' ? entry.location : null }
              : entry
          )
        );
      })
      .subscribe();

    const locationsChannel = supabase
      .channel(`school_fleet_locations:${schoolId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_locations' }, (payload) => {
        const row = payload.new as TripLocation;
        setFleet((current) =>
          current.map((entry) => (entry.trip?.id === row.trip_id ? { ...entry, location: row } : entry))
        );
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(tripsChannel);
      supabase.removeChannel(locationsChannel);
    };
  }, [schoolId]);

  return fleet;
}
