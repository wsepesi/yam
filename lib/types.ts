export interface Student {
  First_Name: string;
  Last_Name: string;
  Default_Email: string;
  University_ID: string;
}

export interface PackageNoIds {
  First: string;
  Last: string;
  Email: string;
  provider: string;
  residentId: string;
}

export interface Package extends PackageNoIds {
  packageId: string;
  status: 'pending' | 'picked_up' | 'failed';
  createdAt: string;
  updatedAt: string;
  residentId: string;
}

export interface AcProps<T = Student> {
  apiRoute: string;
  acLabel: string;
  displayOption: (option: T) => string;
  record: T | null;
  setRecord: (record: T | null) => void;
  setLoaded: (loaded: boolean) => void;
  actionButton?: React.ReactNode;
  headers?: Record<string, string>;
}

export interface Resident {
  id: string; // UUID
  mailroom_id: string; // UUID
  first_name: string;
  last_name: string;
  student_id: string;
  email?: string; // Optional
  created_at: string; // TIMESTAMPTZ
  updated_at: string; // TIMESTAMPTZ
  added_by: string; // UUID
} 