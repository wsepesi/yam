import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button'; // Assuming you use shadcn/ui button
import Layout from '@/components/Layout'; // Assuming you have a Layout component
import { useRouter } from 'next/router';

const SUPABASE_VERIFY_URL_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`;
const SITE_URL = "https://useyam.com";
const REGISTER_PATH = "/register";

const ConfirmSignupPage = () => {
  const router = useRouter();
  const [confirmationUrl, setConfirmationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (router.isReady) {
      const { token } = router.query;
      if (typeof token === 'string' && token) {
        try {
          // Construct the Supabase verification URL
          const redirectUrl = `${SITE_URL}${REGISTER_PATH}`;
          const supabaseVerifyUrl = `${SUPABASE_VERIFY_URL_BASE}?token=${encodeURIComponent(token)}&type=invite&redirect_to=${encodeURIComponent(redirectUrl)}`;
          // Basic validation for the constructed URL to ensure it's valid
          const url = new URL(supabaseVerifyUrl);
          setConfirmationUrl(url.toString());
        } catch (e) {
          console.error("Error constructing or validating the verification URL:", e);
          setError("There was an issue preparing your confirmation link.");
        }
      } else if (token) {
        setError("The token in the link is incorrectly formatted.");
      } else {
        setError("Confirmation token not found in the link. Please check the link and try again.");
      }
    }
  }, [router.isReady, router.query]);

  const handleProceed = () => {
    console.log(confirmationUrl)
    if (confirmationUrl) {
      // Perform the redirect
      window.location.href = confirmationUrl;
    } else {
      setError("Cannot proceed: Confirmation URL is missing or invalid.");
    }
  };

  if (error) {
    return (
      <Layout title="Error | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="w-full max-w-md p-8 text-center bg-[#ffeedd]">
            <h1 className="text-2xl font-medium text-[#471803] mb-4">Problem with Confirmation Link</h1>
            <p className="text-[#471803] mb-6">{error}</p>
            <Button
              onClick={() => router.push('/login')} // Or to a generic error page/homepage
              className="bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!confirmationUrl && !error) {
    return (
      <Layout title="Processing | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <p className="text-[#471803]">Processing your confirmation link...</p>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title="Confirm Signup | Yam" glassy={false}>
      <div className="flex flex-1 justify-center items-center h-full">
        <div className="w-full max-w-md p-8 text-center bg-[#ffeedd] space-y-6">
          <h1 className="text-2xl font-medium tracking-tight text-[#471803]">
            Confirm Your Account
          </h1>
          <p className="text-[#471803]/80">
            Please click the button below to proceed with your account confirmation and complete your registration.
          </p>
          <Button
            onClick={handleProceed}
            disabled={!confirmationUrl}
            className="w-full bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
          >
            Proceed to Confirmation
          </Button>
           {/* Optional: Display the URL for transparency or debugging, remove for production */}
           {/* <p className="text-xs text-gray-500 mt-4">
            Debug: {confirmationUrl}
          </p> */}
        </div>
      </div>
    </Layout>
  );
};

export default ConfirmSignupPage; 