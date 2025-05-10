import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Layout from '@/components/Layout';
import { NextPage } from 'next';
import { getUserRedirectPath } from '@/lib/userPreferences';
import { useAuth } from '@/context/AuthContext';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

// Define the form schema using Zod
const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

type LoginFormValues = z.infer<typeof formSchema>;

const Login: NextPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); 
  const { signIn, userProfile } = useAuth();
  const { callbackUrl } = router.query;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);
    console.log('Login attempt started for email:', data.email);

    try {
      console.log('Calling signIn method...');
      const result = await signIn(data.email, data.password);
      console.log('SignIn method returned:', result);
      
      if (result.error) {
        console.error('Login failed with error:', result.error);
        setError(result.error.message);
        setIsLoading(false);
        return;
      }

      // Check if we have a callback URL
      console.log('Login successful, preparing redirection');
      let redirectPath;
      
      if (callbackUrl && typeof callbackUrl === 'string' && !callbackUrl.includes('/login')) {
        redirectPath = callbackUrl;
        console.log('Redirecting to callback URL:', redirectPath);
      } else {
        // Default to org/mailroom structure if no valid callback
        console.log('Getting user redirect path...');
        try {
          redirectPath = await getUserRedirectPath(userProfile);
          console.log('Received redirect path:', redirectPath);
        } catch (pathError) {
          console.error('Error getting redirect path:', pathError);
          setError('Failed to find your mailroom. Please contact support.');
          setIsLoading(false);
          return; // Prevent further execution and navigation
        }
      }
      
      console.log('Attempting navigation to:', redirectPath);
      setIsLoading(false); // Set loading to false before navigation to prevent hanging
      
      try {
        await router.push(redirectPath);
        console.log('Router navigation completed');
      } catch (navError) {
        console.error('Navigation error:', navError);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Layout title="Yam | Login" glassy={false}>
      <div className="flex flex-1 justify-center items-center h-full">
        {/* Form Container */}
        <div className="w-full max-w-sm p-8 space-y-6 bg-[#ffeedd] -2">
          <div className="text-center">
             <h1 className="text-2xl font-medium tracking-tight text-[#471803] mb-4">
              Log in to 🍠
            </h1>
            {/* <p className="text-sm text-[#471803]/80">
              Enter your credentials to access the platform.
            </p> */}
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-[#471803]/90">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...form.register('email')}
                className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
                disabled={isLoading}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <Label htmlFor="password" className="text-[#471803]/90">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                {...form.register('password')}
                className="bg-white border-[#471803]/50 focus:border-[#471803] focus:ring-[#471803] rounded-none w-full"
                disabled={isLoading}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none">
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default Login;