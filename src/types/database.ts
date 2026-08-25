export type Role = 'admin' | 'driver' | 'parent';

export type Profile = {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
  push_token: string | null;
  notify_minutes_before: number;
  created_at: string;
};

export type Bus = {
  id: string;
  name: string;
  license_plate: string | null;
  driver_id: string | null;
  created_at: string;
};

export type Route = {
  id: string;
  name: string;
  bus_id: string | null;
  created_at: string;
};

export type Stop = {
  id: string;
  route_id: string;
  name: string;
  lat: number;
  lng: number;
  sequence_order: number;
  created_at: string;
};

export type Student = {
  id: string;
  full_name: string;
  parent_id: string;
  route_id: string;
  stop_id: string;
  created_at: string;
};

export type TripStatus = 'active' | 'completed';

export type Trip = {
  id: string;
  route_id: string;
  bus_id: string;
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
