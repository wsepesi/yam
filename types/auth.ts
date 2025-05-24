// types/auth.ts
export interface User {
  id: string;
  email: string;
  name: string;
  // Base user info from next-auth
}

export interface ExtendedUser extends User {
  roles: {
    organizationId: string;
    role: "admin" | "manager" | "receptionist";
  }[];
}

// Example organization structure
export interface Organization {
  id: string;
  name: string;
  type: "university" | "dorm";
  parentId?: string; // For hierarchical relationship
}
