import NextAuth, { type NextAuthOptions } from 'next-auth';
import { SupabaseAdapter } from '@auth/supabase-adapter';
import GithubProvider from 'next-auth/providers/github'; // Example provider
// Import other providers you want (e.g., GoogleProvider, EmailProvider)
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Define your role type - adjust if needed
type UserRole = 'user' | 'manager' | 'admin' | 'super-admin';

// Initialize Supabase client for fetching roles (use service role key for elevated privileges)
// Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const authOptions: NextAuthOptions = {
  providers: [
    // Add your desired authentication providers here
    // Example using GitHub: Ensure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are set
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    // Add other providers like Google, etc.
  ],
  adapter: SupabaseAdapter({
    url: process.env.SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  session: {
    strategy: 'jwt', // Use JWT for session strategy is recommended
  },
  callbacks: {
    async session({ session, token }) {
      // Add Supabase access token for RLS if JWT secret is set
      const signingSecret = process.env.SUPABASE_JWT_SECRET;
      if (signingSecret && token.sub) {
        const payload = {
          aud: 'authenticated',
          exp: Math.floor(new Date(session.expires).getTime() / 1000),
          sub: token.sub,
          email: token.email,
          role: 'authenticated', // Default Supabase role for RLS policies
        };
        session.supabaseAccessToken = jwt.sign(payload, signingSecret);
      }

      // Add custom user role and ID to the session from the token
      if (token.sub && session.user) {
         session.user.id = token.sub;
         session.user.role = token.role as UserRole; // Assign role from token
      }

      return session;
    },
    async jwt({ token, user, isNewUser }) {
       // On sign in, persist the user ID & fetch/persist the role into the JWT
       if (user) { // user is only passed on initial sign in
         token.sub = user.id;
         // Fetch role from DB upon initial sign in or if role is missing
         if (user.id && (isNewUser || !token.role)) {
            try {
               // Assumes a 'profiles' table linked to auth.users via 'id'
               // and a 'role' column on 'profiles'. Adjust if your schema differs.
               const { data, error } = await supabaseAdmin
                 .from('profiles') // ADJUST TABLE NAME if different
                 .select('role')
                 .eq('id', user.id)
                 .single();

               if (error) {
                 console.error(`Error fetching role for new/existing user ${user.id}:`, error);
                 token.role = 'user'; // Default role on error
               } else if (data) {
                 token.role = data.role;
               } else {
                  console.warn(`Role not found for user ${user.id}, defaulting to 'user'.`);
                  token.role = 'user'; // Default role if no profile/role found
               }
            } catch(e) {
                console.error(`Exception fetching user role for ${user.id}:`, e);
                token.role = 'user'; // Default on exception
            }
         }
       }
       return token;
    },
  },
  // Ensure NEXTAUTH_URL and NEXTAUTH_SECRET are set in environment variables
  secret: process.env.NEXTAUTH_SECRET, // Required for JWT strategy
  // Add custom pages if needed
  // pages: {
  //   signIn: '/login', // Redirect users to /login page
  //   // error: '/auth/error', // Error code passed in query string as ?error=
  //   // verifyRequest: '/auth/verify-request', // (used for email/credential)
  // }
};

export default NextAuth(authOptions);
