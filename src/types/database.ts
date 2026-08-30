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

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type Group = {
  id: string;
  name: string;
  driver_id: string;
  school_id: string | null;
  join_code: string;
  created_at: string;
  verification_status: VerificationStatus;
  verified_at: string | null;
  verified_by: string | null;
  id_document_path: string | null;
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

export type BoardingStatus = 'boarded' | 'dropped_off';

export type BoardingEvent = {
  id: number;
  trip_id: string;
  student_id: string;
  status: BoardingStatus;
  recorded_at: string;
  recorded_by: string;
};

export type Absence = {
  id: string;
  student_id: string;
  absence_date: string;
  created_by: string;
  created_at: string;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  driver_id: string;
  body: string;
  created_at: string;
};
