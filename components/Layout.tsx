import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

import { useAuth } from "@/context/AuthContext";

type LayoutProps = {
  children: ReactNode;
  title?: string;
  glassy?: boolean;
};

export default function Layout({
  children,
  title = "Yam",
  glassy = true,
}: LayoutProps) {
  const router = useRouter();
  const isHomepage = router.pathname === "/";
  const isLoginPage = router.pathname === "/login";
  const { isAuthenticated, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const borderColor = "border-[#471803]";
  const textColor = "text-[#471803]";

  return (
    <div className="min-h-screen flex flex-col relative text-gray-800 bg-[#ffeedd]">
      <Head>
        <title>{title}</title>
        <meta name="description" content="Yam platform" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="fixed top-0 left-0 right-0 h-16 z-10 bg-[#ffeedd]">
        <div className="container mx-auto px-6 h-full">
          <nav className="flex justify-between items-center h-full">
            <Link
              href="/"
              className={`text-xl font-[Spectral] font-bold tracking-tight lowercase pl-1 ${textColor}`}
            >
              🍠 yam
            </Link>
            <div className="flex">
              {isHomepage || isLoginPage ? (
                <Link
                  href="/login"
                  className={`text-sm ${textColor} px-4 py-2 ml-2 tracking-wide relative hover:border-b ${borderColor} transition-colors`}
                >
                  login
                </Link>
              ) : isAuthenticated ? (
                <button
                  onClick={handleSignOut}
                  className={`text-sm ${textColor} px-4 py-2 ml-2 tracking-wide relative hover:border-b ${borderColor} transition-colors`}
                >
                  signout
                </button>
              ) : (
                <Link
                  href="/login"
                  className={`text-sm ${textColor} px-4 py-2 ml-2 tracking-wide relative hover:border-b ${borderColor} transition-colors`}
                >
                  login
                </Link>
              )}
              <a
                href="mailto:sales@useyam.com"
                className={`text-sm ${textColor} px-4 py-2 ml-2 mr-2 tracking-wide relative hover:border-b ${borderColor} transition-colors`}
              >
                contact
              </a>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 pt-16 pb-12 flex flex-col">
        {glassy ? (
          <div
            className={`bg-[#fffaf5]/85 shadow-sm p-12 fixed top-16 bottom-12 left-1/2 -translate-x-1/2 w-[85vw] overflow-y-auto border-2 ${borderColor}`}
          >
            <div className="container mx-auto px-6">{children}</div>
          </div>
        ) : (
          <div
            className={`fixed top-16 bottom-12 left-1/2 -translate-x-1/2 w-[85vw] border-6 ${borderColor}`}
          >
            <div
              className={`h-full overflow-y-auto px-6 ${isHomepage ? "flex items-center justify-center" : ""} `}
            >
              {children}
            </div>
          </div>
        )}
      </main>

      <footer
        className={`fixed bottom-0 left-0 right-0 h-12 flex items-center justify-center text-sm ${textColor} bg-[#ffeedd]`}
      />
    </div>
  );
}
