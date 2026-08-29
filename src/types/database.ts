export type Role = 'admin' | 'driver' | 'parent' | 'school';

export type Profile = {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
  push_token: string | null;
  notify_minutes_before: number;
  created_at: string;
};

export type School = {
  id: string;
  name: string;
  owner_id: string;
  join_code: string;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  driver_id: string;
  school_id: string | null;
  join_code: string;
  created_at: string;
};

export type Student = {
  id: string;
  group_id: string;
  parent_id: string;
  full_name: string;
  pickup_lat: number;
  pickup_lng: number;
  created_at: string;
};

export type TripStatus = 'active' | 'completed';

export type Trip = {
  id: string;
  group_id: string;
  driver_id: string;
  status: TripStatus;
  started_at: string;
  ended_at: string | null;
};

export type TripLocation = {
  id: number;
  trip_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
  speed: number | null;
  heading: number | null;
};

export type MapPoint = { id: string; lat: number; lng: number; name: string };
