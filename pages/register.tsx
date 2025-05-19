import * as z from 'zod';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Layout from '@/components/Layout';
import { NextPage } from 'next';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/router';
import { zodResolver } from '@hookform/resolvers/zod';

// Define the form schema using Zod
const formSchema = z.object({
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(64, { message: 'Password must be less than 64 characters' }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof formSchema>;

interface DbInvitationRecord {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string; // Consider validating expiry if needed
  organization_id: string;
  mailroom_id: string;
  // Revert to array type to align with Supabase client's general typing for related tables
  organizations?: { name: string; slug: string } | null;
  mailrooms?: { name: string; slug: string } | null;
}

// Define possible statuses for the component
type RegistrationStatus =
  | 'checking_session'
  | 'validating_invite'
  | 'invalid_invite' // For errors during validation (bad link, expired, used)
  | 'ready_for_password'
  | 'submitting'
  | 'error'; // General errors, e.g., during submission

const Register: NextPage = () => {
  const router = useRouter();
  const [status, setStatus] = useState<RegistrationStatus>('checking_session');
  const [error, setError] = useState<string | null>(null);
  const [fetchedDbInvite, setFetchedDbInvite] = useState<DbInvitationRecord | null>(null);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const { refreshUserProfile } = useAuth(); // Get refreshUserProfile from context

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Effect to check for URL hash errors on initial load
  useEffect(() => {
    const hash = window.location.hash.substring(1); // Remove '#'
    if (hash) {
      const params = new URLSearchParams(hash);
      const errorCode = params.get('error_code');
      const errorParam = params.get('error');
      const errorDescription = params.get('error_description');

      let isOtpError = false;
      let messageFromUrl = '';

      // Prioritize error_code=otp_expired
      if (errorCode === 'otp_expired') {
        isOtpError = true;
        messageFromUrl = errorDescription || 'The email verification link has expired or is invalid.';
      }
      // Fallback to error=access_denied with a descriptive message
      else if (errorParam === 'access_denied' && errorDescription &&
               (errorDescription.toLowerCase().includes('link is invalid or has expired') ||
                errorDescription.toLowerCase().includes('otp_expired'))) {
        isOtpError = true;
        messageFromUrl = errorDescription;
      }

      if (isOtpError) {
        console.warn('Registration link error detected in URL hash:', { errorCode, errorParam, errorDescription });

        const finalMessage = `${messageFromUrl}. If the problem persists, you may need to request a new invitation.`;

        setError(finalMessage);
        setStatus('invalid_invite'); // This will trigger the error UI

        // Clean the URL by removing the hash after processing
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    // This effect runs once on component mount to check the initial URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to manage auth state
  useEffect(() => {
    if (status === 'submitting') {
      return;
    }
    const { data: authListenerData } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth State Change:', event, session ? { userEmail: session.user?.email, eventType: event } : 'No session');

      const knownNonResettableStates: RegistrationStatus[] = [
        'validating_invite', 'ready_for_password', 'submitting', 'invalid_invite', 'error'
      ];

      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          // User has an initial session.
          if (!sessionUser || sessionUser.id !== session.user.id) {
            setSessionUser(session.user); // Update session user
          }
          // If status is an unexpected state (not known non-resettable and not checking_session itself),
          // reset to 'checking_session'. Otherwise, if it's already 'checking_session',
          // the update to sessionUser will trigger the validation effect.
          // If it's a known non-resettable state, we don't change status.
          if (!knownNonResettableStates.includes(status) && status !== 'checking_session') {
            setStatus('checking_session');
          }
        } else {
          // No initial session (user is not logged in).
          if (status === 'checking_session') {
            console.warn('INITIAL_SESSION: No user session found and no prior URL error. User likely navigated directly to /register or link was entirely invalid.');
            setError('A valid, authenticated session is required to set your password. Please use the invitation link sent to your email. If you are sure you used the correct link, it might have expired or already been used.');
            setStatus('invalid_invite');
          }
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
        if (!sessionUser || sessionUser.id !== session.user.id) {
           setSessionUser(session.user); // Update session user
        }
        // Similar logic for SIGNED_IN: if status is unexpected, reset to checking_session.
        if (!knownNonResettableStates.includes(status) && status !== 'checking_session') {
          setStatus('checking_session');
        }
      } else if (event === 'SIGNED_OUT') {
        setSessionUser(null);
        setFetchedDbInvite(null); // Clear invite details on sign out
        console.warn('SIGNED_OUT: User session ended on registration page.');
        setError('Your session has ended. To set your password, please use the invitation link again.');
        setStatus('invalid_invite'); // Directly to invalid state as registration cannot proceed.
      } else if (event === 'USER_UPDATED') {
          // User updated (e.g., password change).
          console.log('User updated event received. Minimal handling in listener.');
      }
    });

    return () => {
      authListenerData?.subscription?.unsubscribe();
    };
  }, [sessionUser, status]); 

  // Effect to run validation once the session user is available
  useEffect(() => {
    const validateInvitation = async (user: User) => {
      setStatus('validating_invite');
      setError(null); // Clear previous errors

      const invitationId = user.user_metadata?.invitation_id;
      if (!invitationId) {
        console.error('Invitation ID not found in user metadata.');
        setError('Your account is missing the required invitation details. Please contact support.');
        setStatus('invalid_invite');
        return;
      }

      try {
        console.log(`Fetching invitation with ID: ${invitationId}`);
        // Fetch invitation and related names
        const { data, error: dbError } = await supabase
          .from('invitations')
          .select(`
            id, email, role, status, expires_at, organization_id, mailroom_id,
            organizations ( name, slug ),
            mailrooms ( name, slug )
          `)
          .eq('id', invitationId)
          .single();

        if (dbError) {
          console.error('Error fetching invitation:', dbError);
          setError(`Failed to retrieve invitation details: ${dbError.message}`);
          setStatus('invalid_invite');
          return;
        }

        if (!data) {
            console.error('No invitation found for ID:', invitationId);
            setError('Invitation not found. This link may be invalid.');
            setStatus('invalid_invite');
            return;
        }

        // Check user email against invitation email
        if (user.email !== data.email) {
            console.warn(`Session email (${user.email}) does not match invitation email (${data.email})`);
            setError('You are logged in with a different email than the one invited. Please use the correct account or contact support.');
            setStatus('invalid_invite');
            return;
        }

        if (data.status !== 'PENDING') {
          console.log('Invitation status is not PENDING:', data.status);
          const message = data.status === 'RESOLVED' || data.status === 'USED'
            ? 'This invitation has already been used.'
            : data.status === 'EXPIRED'
            ? 'This invitation has expired.'
            : data.status === 'CANCELLED'
            ? 'This invitation has been cancelled.'
            : `This invitation is in an invalid state (${data.status.toLowerCase()}).`;
          setError(message);
          setStatus('invalid_invite');
          return;
        }

        // TODO: Optionally check expires_at here
        // const expiryDate = new Date(data.expires_at);
        // if (expiryDate < new Date()) {
        //   setError('This invitation has expired.');
        //   setStatus('invalid_invite');
        //   // Optionally update status in DB to EXPIRED
        //   return;
        // }

        console.log('Invitation validated successfully:', data);
        setFetchedDbInvite(data as unknown as DbInvitationRecord);
        setStatus('ready_for_password');

      } catch (err) {
        console.error('Exception during invitation validation:', err);
        setError(`Validation failed unexpectedly: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setStatus('error'); // Use general error for unexpected issues
      }
    };

    // Trigger validation only when we have a user and are in the initial state
    if (sessionUser && status === 'checking_session') {
      validateInvitation(sessionUser);
    }

    // Dependency array: React to sessionUser changes and ensure validation runs when status is 'checking_session'
  }, [sessionUser, status]);

  const onSubmit = async (formData: RegisterFormValues) => {
    if (!fetchedDbInvite || !sessionUser) {
      setError('Cannot submit: Missing invitation details or user session. Please refresh.');
      setStatus('error'); // Indicate a state inconsistency
      return;
    }
     if (sessionUser.email !== fetchedDbInvite.email) {
      setError('Session email mismatch. Please ensure you are logged in with the invited email.');
      setStatus('ready_for_password'); // Revert to form state
      return;
    }

    setStatus('submitting');
    setError(null);

    // Use a stable reference to the user for the duration of the submit function
    const currentUser = sessionUser;

    try {
      console.log('Attempting to update password for user:', currentUser.email);
      const { error: updateUserError } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (updateUserError) {
        console.error('Error updating user password:', updateUserError);
        setError(`Password update failed: ${updateUserError.message}`);
        setStatus('ready_for_password'); // Allow retry
        return;
      }

      console.log('User password updated successfully for:', currentUser.email);

       if (!currentUser?.id) {
           console.error('onSubmit: User ID missing after password update.');
           setError('User session issue after password update. Please try logging in again.');
           setStatus('error');
           return;
       }

      console.log(`onSubmit: Updating invitation status to RESOLVED for ID: ${fetchedDbInvite.id} with user ID: ${currentUser.id}`);
      const { error: invitationUpdateError } = await supabase
        .from('invitations')
        .update({
          status: 'RESOLVED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', fetchedDbInvite.id);

      if (invitationUpdateError) {
        console.error('onSubmit: Error updating invitation status to RESOLVED:', invitationUpdateError);
      } else {
        console.log('onSubmit: Invitation status successfully updated to RESOLVED.');
      }

      console.log(`onSubmit: Attempting to update profile status to ACTIVE for user ID: ${currentUser.id}`);
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ status: 'ACTIVE' }) // Ensure 'profiles' table and 'status' column exist
        .eq('id', currentUser.id);

       if (profileUpdateError) {
        console.error('onSubmit: Error updating profile status to ACTIVE:', profileUpdateError);
        // Decide if this is critical. If so, maybe setError and return.
        // If not critical (e.g., context refresh might fix it), log and continue.
      } else {
        console.log(`onSubmit: Successfully updated profile status to ACTIVE for user: ${currentUser.id}`);
        // Profile DB update successful, now refresh the AuthContext state
        console.log('onSubmit: Refreshing AuthContext profile...');
        await refreshUserProfile();
        console.log('onSubmit: AuthContext profile refreshed.');
      }

      // Validate that slugs exist before attempting redirection
      if (!fetchedDbInvite.organizations || !fetchedDbInvite.organizations.slug) {
        console.error('onSubmit: Organization slug is missing.');
        setError('Critical data missing for redirection (organization slug). Please contact support.');
        setStatus('error'); // Or 'ready_for_password' if you want to allow retry without re-fetching invite
        return;
      }

      if (!fetchedDbInvite.mailrooms || !fetchedDbInvite.mailrooms.slug) {
        console.error('onSubmit: Mailroom slug is missing.');
        setError('Critical data missing for redirection (mailroom slug). Please contact support.');
        setStatus('error'); // Or 'ready_for_password'
        return;
      }

      console.log('onSubmit: Registration complete. Redirecting to dashboard...');
      router.push(`/${fetchedDbInvite.organizations.slug}/${fetchedDbInvite.mailrooms.slug}/`);

    } catch (err) {
      console.error('onSubmit: Registration submission error:', err);
      setError('An unexpected error occurred during submission. Please try again.');
      setStatus('ready_for_password'); // Allow retry on unexpected errors
    }
  };

  // --- Conditional Rendering based on Status ---

  if (status === 'checking_session' || status === 'validating_invite') {
    return (
      <Layout title="Validating Invitation | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="text-center">
            <p className="text-[#471803] mb-2">
              {status === 'checking_session' ? 'Checking your session...' : 'Validating your invitation...'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (status === 'invalid_invite' || (status === 'error' && !fetchedDbInvite)) {
     return (
      <Layout title="Invitation Problem | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="w-full max-w-md p-8 text-center bg-[#ffeedd]">
            <h1 className="text-2xl font-medium text-[#471803] mb-4">
              {status === 'invalid_invite' ? 'Invitation Problem' : 'Error'}
            </h1>
            <p className="text-[#471803] mb-6">{error || 'An unexpected error occurred.'}</p>
            <Button
              onClick={() => router.push('/login')} // Redirect to login for invalid invites
              className="bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (status === 'ready_for_password' || status === 'submitting' || (status === 'error' && fetchedDbInvite)) {
     if (!fetchedDbInvite) {
        return (
            <Layout title="Error | Yam" glassy={false}>
                <div className="flex flex-1 justify-center items-center h-full">
                <p className="text-red-600">Internal error: Missing invitation details in password state.</p>
                </div>
            </Layout>
        );
     }

    // Extract names, fallback to IDs or generic text, using [0] for array access
    const mailroomName = fetchedDbInvite.mailrooms?.name || `Mailroom (${fetchedDbInvite.mailroom_id})`;
    const organizationName = fetchedDbInvite.organizations?.name || `Organization (${fetchedDbInvite.organization_id})`;

    return (
      <Layout title="Complete Registration | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="w-full max-w-md p-8 space-y-6 bg-[#ffeedd]">
            <div className="text-center">
              <h1 className="text-2xl font-medium tracking-tight text-[#471803] mb-2">
                Set Your Password
              </h1>
              <div className="text-sm text-[#471803]/80 mb-4">
                 <p>You&apos;ve been invited to join</p>
                 <p className="font-medium">
                   {mailroomName} at {organizationName}
                 </p>
                 <p className="mt-2">as a <span className="font-medium">{fetchedDbInvite.role || 'user'}</span></p>
                 <p className="mt-1">Email: {fetchedDbInvite.email}</p>
              </div>
            </div>

            {(error && (status === 'ready_for_password' || status === 'error')) && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="password" className="text-[#471803]/90">Create Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Set your password"
                  {...form.register('password')}
                  className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
                  disabled={status === 'submitting'}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirmPassword" className="text-[#471803]/90">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  {...form.register('confirmPassword')}
                  className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
                  disabled={status === 'submitting'}
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-xs text-red-600">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
              >
                {status === 'submitting' ? 'Setting Password...' : 'Complete Registration & Set Password'}
              </Button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Registration | Yam" glassy={false}>
      <div className="flex flex-1 justify-center items-center h-full">
        <p className="text-[#471803]">Loading registration page or encountered an unexpected state.</p>
      </div>
    </Layout>
  );
};

export default Register;