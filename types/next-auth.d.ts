import { type DefaultSession } from 'next-auth';
// import { JWT } from 'next-auth/jwt';

// Define your role type - should match the one in [...nextauth].ts
type UserRole = 'user' | 'manager' | 'admin';

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    supabaseAccessToken?: string; // Added for Supabase RLS
    user: {
      id: string; // Ensure the ID field is typed
      role: UserRole; // Add the role field
    } & DefaultSession['user']; // Keep default fields like name, email, image
  }

  // Optional: If you need the role on the User object returned by the adapter
  // interface User {
  //   role: UserRole;
  // }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    role?: UserRole; // Add the role field to the JWT
    // sub is already part of the default JWT type (usually string | undefined)
    // If you need it to be strictly string, you can override:
    sub: string;
  }
} 