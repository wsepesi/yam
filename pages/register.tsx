import * as z from 'zod';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Layout from '@/components/Layout';
import { NextPage } from 'next';
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

interface InvitationData {
  email: string;
  organizationName: string;
  mailroomName: string;
  role: string;
  isExpired: boolean;
}

const Register: NextPage = () => {
  const router = useRouter();
  const { token: queryToken } = router.query;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [validationStep, setValidationStep] = useState<string>('Initializing validation...');
  const { signIn } = useAuth();
  const [tokenForSubmit, setTokenForSubmit] = useState<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Combine token extraction and validation in a single effect
  useEffect(() => {
    const validateInvitation = async () => {
      if (!router.isReady) {
        console.log('Router not ready yet');
        return;
      }

      console.log('Starting combined token extraction and validation');
      setValidationStep('Checking invitation token...');

      // Extract token directly - no state updates to wait for
      let tokenToUse: string | null = null;

      // Check query param first
      if (typeof queryToken === 'string' && queryToken) {
        console.log('Using token from query params');
        tokenToUse = queryToken;
      } 
      // Then check hash
      else if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash) {
          console.log('Found hash in URL:', hash.substring(0, 15) + '...');
          const hashParams = new URLSearchParams(hash.substring(1));
          
          // Check for access_token with type=invite
          const accessToken = hashParams.get('access_token');
          const tokenType = hashParams.get('type');
          
          if (accessToken && tokenType === 'invite') {
            console.log('Found invite token in hash fragment');
            tokenToUse = accessToken;
          } else if (accessToken) {
            console.log('Found access_token in hash');
            tokenToUse = accessToken;
          } else {
            // Try alternative token parameters
            const altToken = hashParams.get('token') || hashParams.get('invite_token');
            if (altToken) {
              console.log('Found alternative token in hash');
              tokenToUse = altToken;
            }
          }
        }
      }

      // No token found
      if (!tokenToUse) {
        console.error('No valid token found in URL or hash');
        setError('Invalid invitation link. No valid token found.');
        setIsValidating(false);
        return;
      }

      // Clean the token if it ends with /register
      if (tokenToUse.endsWith('/register')) {
        const originalToken = tokenToUse;
        tokenToUse = tokenToUse.substring(0, tokenToUse.length - '/register'.length);
        console.log(`Cleaned token: removed '/register' from '${originalToken}', new token: '${tokenToUse}'`);
      }

      console.log('Token found, proceeding with validation');
      setTokenForSubmit(tokenToUse); // Save the token for form submission later
      
      try {
        // Fetch the invitation details
        setValidationStep('Fetching invitation details...');
        console.log('Fetching invitation with token:', tokenToUse);
        
        const { data, error } = await supabase
          .from('invitations')
          .select(`
            email, 
            role,
            status,
            expires_at,
            organization_id,
            mailroom_id
          `)
          .eq('token', tokenToUse)
          .single();

        console.log('Supabase query data:', data);
        console.log('Supabase query error:', error);

        if (error) {
          console.error('Error fetching invitation:', error);
          setError(`Invitation error: ${error.message || 'Failed to fetch invitation'}`);
          setIsValidating(false);
          return;
        }

        if (!data) {
          console.error('No invitation data found for token after query. Data object:', data);
          setError('Invitation not found');
          setIsValidating(false);
          return;
        }

        console.log('Invitation found:', { ...data, token: '[REDACTED]' });

        // Check if invitation is already used
        if (data.status !== 'PENDING') {
          console.log('Invitation already used');
          setError('This invitation has already been used');
          setIsValidating(false);
          return;
        }

        // Check if invitation is expired
        const now = new Date();
        const expiresAt = new Date(data.expires_at);
        const isExpired = now > expiresAt;

        if (isExpired) {
          console.log('Invitation expired', { expires: data.expires_at, now: now.toISOString() });
          setError('This invitation has expired');
          setIsValidating(false);
          return;
        }

        // Fetch organization details
        setValidationStep('Fetching organization details...');
        console.log('Fetching organization with ID:', data.organization_id);
        
        let organizationName = 'Unknown Organization';
        try {
          const orgResponse = await supabase
            .from('organizations')
            .select('name')
            .eq('id', data.organization_id)
            .single();
            
          if (orgResponse.error) {
            console.error('Error fetching organization:', orgResponse.error);
          } else if (orgResponse.data) {
            organizationName = orgResponse.data.name;
            console.log('Organization found:', organizationName);
          } else {
            console.warn('No organization found with ID:', data.organization_id);
          }
        } catch (orgError) {
          console.error('Exception fetching organization:', orgError);
        }
        
        // Fetch mailroom details
        setValidationStep('Fetching mailroom details...');
        console.log('Fetching mailroom with ID:', data.mailroom_id);
        
        let mailroomName = 'Unknown Mailroom';
        try {
          const mailroomResponse = await supabase
            .from('mailrooms')
            .select('name')
            .eq('id', data.mailroom_id)
            .single();
            
          if (mailroomResponse.error) {
            console.error('Error fetching mailroom:', mailroomResponse.error);
          } else if (mailroomResponse.data) {
            mailroomName = mailroomResponse.data.name;
            console.log('Mailroom found:', mailroomName);
          } else {
            console.warn('No mailroom found with ID:', data.mailroom_id);
          }
        } catch (mailroomError) {
          console.error('Exception fetching mailroom:', mailroomError);
        }

        // Set invitation data
        setValidationStep('Setting invitation data...');
        setInvitation({
          email: data.email,
          organizationName: organizationName,
          mailroomName: mailroomName,
          role: data.role,
          isExpired: isExpired,
        });

        // Update the invitation status to RESOLVED
        const { error: updateError } = await supabase
          .from('invitations')
          .update({ status: 'RESOLVED' })
          .eq('token', tokenToUse);

        if (updateError) {
          console.error('Error updating invitation status to RESOLVED:', updateError);
        }
        
        console.log('Validation complete, setting isValidating to false');
        setIsValidating(false);
      } catch (err) {
        console.error('Unhandled exception during validation:', err);
        setError(`Validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsValidating(false);
      }
    };

    validateInvitation();
  }, [router.isReady, queryToken]);

  const onSubmit = async (data: RegisterFormValues) => {
    if (!invitation || !tokenForSubmit) {
      setError('Invalid invitation');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create new user with the invitation email and provided password
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password: data.password,
      });

      if (signUpError) {
        console.error('Error signing up:', signUpError);
        setError(`Registration failed: ${signUpError.message}`);
        
        // Mark invitation as FAILED if signup fails
        const { error: updateError } = await supabase
          .from('invitations')
          .update({ status: 'FAILED' })
          .eq('token', tokenForSubmit);
          
        if (updateError) {
          console.error('Error updating invitation status to FAILED:', updateError);
        }
        
        setIsLoading(false);
        return;
      }

      const user = signUpData.user;
      const session = signUpData.session;

      if (!user) {
        console.error('Sign up successful but no user data returned.');
        setError('Registration failed: No user data received. Please try again.');
        // Mark invitation as FAILED
        await supabase.from('invitations').update({ status: 'FAILED' }).eq('token', tokenForSubmit);
        setIsLoading(false);
        return;
      }
      
      console.log('User signed up successfully:', { id: user.id, email: user.email });

      if (session) {
        console.log('Session created successfully after signup. User is logged in.');
        // AuthContext should pick this up via onAuthStateChange
      } else {
        console.warn('No session returned after signup. Email confirmation might be pending.');
      }

      // Mark the invitation as used and update status to RESOLVED
      const { error: updateError } = await supabase
        .from('invitations')
        .update({ 
          used: true,
          status: 'RESOLVED' 
        })
        .eq('token', tokenForSubmit);

      if (updateError) {
        console.error('Error updating invitation status:', updateError);
        // Continue with sign-in despite invitation update error
      }

      // Update the user's profile status to ACTIVE using the user ID from signUpData
      console.log('Attempting to update profile for user ID:', user.id);
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ status: 'ACTIVE' })
        .eq('id', user.id); // Use the user ID from signUp response

      if (profileUpdateError) {
        console.error('Error updating profile status to ACTIVE:', profileUpdateError);
        // Decide if this error is critical enough to halt the process
        // or just log it. For now, logging.
      } else {
        console.log('Successfully updated profile status to ACTIVE for user:', user.id);
      }

      // If signUp didn't return a session, attempt explicit sign-in.
      // This will likely fail if email confirmation is pending.
      if (!session) {
        console.log('No session from signUp, attempting explicit sign-in.');
        const { error: signInError } = await signIn(
          invitation.email,
          data.password
        );

        if (signInError) {
          console.error('Error signing in after signup:', signInError);
          setError(`Sign-in failed: ${signInError.message}. Please check your email for a confirmation link if required.`);
          setIsLoading(false);
          // Optionally, revert invitation status or handle differently
          return; // Stop here if sign-in fails
        }
        console.log('Explicit sign-in successful.');
      } else {
        console.log('Skipping explicit sign-in as session was provided by signUp.');
        // If AuthContext is set up with onAuthStateChange, it should handle the session from signUp.
      }

      // Redirect to the organization's mailroom
      console.log('Registration and sign-in process complete. Redirecting to /');
      router.push('/');
    } catch (err) {
      console.error('Registration error:', err);
      setError('An unexpected error occurred. Please try again.');
      
      // Mark invitation as FAILED on unexpected errors
      try {
        await supabase
          .from('invitations')
          .update({ status: 'FAILED' })
          .eq('token', tokenForSubmit);
      } catch (updateErr) {
        console.error('Error updating invitation status after error:', updateErr);
      }
      
      setIsLoading(false);
    }
  };

  // Show loading state while validating the token
  if (isValidating) {
    return (
      <Layout title="Validating Invitation | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="text-center">
            <p className="text-[#471803] mb-2">Validating your invitation...</p>
            <p className="text-sm text-[#471803]/80">{validationStep}</p>
            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm max-w-md mx-auto">
                {error}
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // Show error if token is invalid
  if (error && !invitation) {
    return (
      <Layout title="Invalid Invitation | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="w-full max-w-md p-8 text-center bg-[#ffeedd]">
            <h1 className="text-2xl font-medium text-[#471803] mb-4">
              Invalid Invitation
            </h1>
            <p className="text-[#471803] mb-6">{error}</p>
            <Button 
              onClick={() => router.push('/login')}
              className="bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Complete Registration | Yam" glassy={false}>
      <div className="flex flex-1 justify-center items-center h-full">
        <div className="w-full max-w-md p-8 space-y-6 bg-[#ffeedd]">
          <div className="text-center">
            <h1 className="text-2xl font-medium tracking-tight text-[#471803] mb-2">
              Complete Your Registration
            </h1>
            {invitation && (
              <div className="text-sm text-[#471803]/80 mb-4">
                <p>You&apos;ve been invited to join</p>
                <p className="font-medium">{invitation.mailroomName} at {invitation.organizationName}</p>
                <p className="mt-2">as a <span className="font-medium">{invitation.role}</span></p>
                <p className="mt-1">Email: {invitation.email}</p>
              </div>
            )}
          </div>

          {error && (
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
                disabled={isLoading}
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
                disabled={isLoading}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-red-600">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
            >
              {isLoading ? 'Creating Account...' : 'Complete Registration'}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default Register;