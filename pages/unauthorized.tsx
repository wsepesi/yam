import { useRouter } from "next/router";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function Unauthorized() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <Layout title="Unauthorized Access | Yam" glassy={false}>
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-full max-w-md p-8 bg-[#ffeedd] text-center">
          <h1 className="text-2xl font-semibold text-[#471803] mb-4">
            Unauthorized Access
          </h1>
          <p className="text-[#471803] mb-6">
            You don&apos;t have permission to access this page. Please contact
            an administrator if you believe this is an error.
          </p>
          <div className="flex flex-col space-y-3">
            <Button
              onClick={() => router.push("/")}
              className="bg-[#471803] hover:bg-[#471803]/90 text-white py-2 rounded-none"
            >
              Go to Home
            </Button>
            <Button
              onClick={() => signOut()}
              variant="outline"
              className="border-[#471803] text-[#471803] hover:bg-[#471803]/10 py-2 rounded-none"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
