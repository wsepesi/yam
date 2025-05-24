import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Layout from '@/components/Layout';
import { useRouter } from 'next/router';

const SUPABASE_VERIFY_URL_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`;
const SITE_URL = "https://useyam.com";
const REGISTER_PATH = "/register";

type PageStep = 'loading' | 'emailInput' | 'confirmProceed' | 'error';

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const ConfirmSignupPage = () => {
  const router = useRouter();
  const [pageStep, setPageStep] = useState<PageStep>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState<string>('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [confirmationUrl, setConfirmationUrl] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) {
      setPageStep('loading');
      return;
    }

    const tokenParam = router.query.token;
    if (typeof tokenParam === 'string' && tokenParam) {
      setToken(tokenParam);
      setGeneralError(null);
      setPageStep('emailInput');
    } else if (tokenParam) {
      setToken(null);
      setGeneralError("The token in the link is incorrectly formatted.");
      setPageStep('error');
    } else {
      setToken(null);
      setGeneralError("Confirmation token not found in the link. Please check the link and try again.");
      setPageStep('error');
    }
  }, [router.isReady, router.query]);

  const handleEmailInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmailInput(newEmail);
    if (isValidEmail(newEmail)) {
      setEmailError(null); // Clear error if input becomes valid
    }
  };

  const handleEmailSubmit = () => {
    if (!isValidEmail(emailInput)) { // Re-check here, though button visibility should prevent this
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);

    if (token) {
      try {
        const redirectUrl = `${SITE_URL}${REGISTER_PATH}`;
        const supabaseVerifyUrl = `${SUPABASE_VERIFY_URL_BASE}?token=${encodeURIComponent(token)}&type=invite&redirect_to=${encodeURIComponent(redirectUrl)}`;
        const url = new URL(supabaseVerifyUrl);
        setConfirmationUrl(url.toString());
        setGeneralError(null);
        setPageStep('confirmProceed');
      } catch (e) {
        console.error("Error constructing or validating the verification URL:", e);
        setGeneralError("There was an issue preparing your confirmation link.");
        setConfirmationUrl(null);
        setPageStep('error');
      }
    } else {
      setGeneralError("Confirmation token is missing. Cannot proceed.");
      setPageStep('error');
    }
  };

  const handleProceed = () => {
    if (confirmationUrl) {
      window.location.href = confirmationUrl;
    } else {
      setGeneralError("Cannot proceed: Confirmation URL is missing or invalid.");
      setPageStep('error');
    }
  };

  if (pageStep === 'loading') {
    return (
      <Layout title="Processing | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <p className="text-[#471803]">Processing your confirmation link...</p>
        </div>
      </Layout>
    );
  }

  if (pageStep === 'error') {
    return (
      <Layout title="Error | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="w-full max-w-md p-8 text-center bg-[#ffeedd]">
            <h1 className="text-2xl font-medium text-[#471803] mb-4">Problem with Confirmation</h1>
            <p className="text-[#471803] mb-6">{generalError}</p>
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

  if (pageStep === 'emailInput') {
    return (
      <Layout title="Confirm Email | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="w-full max-w-md p-8 text-center bg-[#ffeedd] space-y-6">
            <h1 className="text-2xl font-medium tracking-tight text-[#471803]">
              Enter Your Email
            </h1>
            <p className="text-[#471803]/80">
              Please enter your email address to proceed with account confirmation.
            </p>
            <Input
              type="email"
              value={emailInput}
              onChange={handleEmailInputChange}
              placeholder="you@example.com"
              className="w-full p-2 border border-[#471803]/30 rounded-md focus:ring-[#471803] focus:border-[#471803] bg-white text-[#471803]"
            />
            {emailError && <p className="text-red-500 text-sm -mt-3 mb-3">{emailError}</p>}
            {isValidEmail(emailInput) && (
              <Button
                onClick={handleEmailSubmit}
                className="w-full bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
              >
                Submit Email
              </Button>
            )}
          </div>
        </div>
      </Layout>
    );
  }
  
  if (pageStep === 'confirmProceed') {
    return (
      <Layout title="Confirm Signup | Yam" glassy={false}>
        <div className="flex flex-1 justify-center items-center h-full">
          <div className="w-full max-w-md p-8 text-center bg-[#ffeedd] space-y-6">
            <h1 className="text-2xl font-medium tracking-tight text-[#471803]">
              Confirm Your Account
            </h1>
            <p className="text-[#471803]/80">
              Your confirmation link is ready. Click below to complete your registration.
            </p>
            <Button
              onClick={handleProceed}
              disabled={!confirmationUrl}
              className="w-full bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
            >
              Proceed to Confirmation
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return null; // Should not be reached
};

export default ConfirmSignupPage;
