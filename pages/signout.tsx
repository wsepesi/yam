import { useRouter } from "next/router";
import { useEffect } from "react";

import Layout from "@/components/Layout"; // Optional: if you want to show a layout during signout
import { useAuth } from "@/context/AuthContext";

const SignOutPage = () => {
  const { signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const performSignOut = async () => {
      try {
        await signOut();
        router.push("/"); // Redirect to homepage after sign out
      } catch (error) {
        console.error("Error during sign out:", error);
        // Optionally, handle error (e.g., show a message to the user)
        // For now, still redirect to homepage
        router.push("/");
      }
    };

    performSignOut();
  }, [signOut, router]);

  return (
    <Layout title="Signing Out..." glassy={false}>
      <div className="flex flex-1 justify-center items-center h-full">
        <p className="text-lg text-[#471803]">Signing you out...</p>
      </div>
    </Layout>
  );
};

export default SignOutPage;
