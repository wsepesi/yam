// components/Layout.tsx
import Head from 'next/head';
import Link from 'next/link';
import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

type LayoutProps = {
  children: ReactNode;
  title?: string;
  glassy?: boolean;
};

export default function Layout({ children, title = 'Yam', glassy = true }: LayoutProps) {
  const router = useRouter();
  const isHomepage = router.pathname === '/';
  const isLoginPage = router.pathname === '/login';
  const { isAuthenticated, signOut } = useAuth();

  const handleSignOut = async () => {
    // router.push('/');
    await signOut();
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-[#ffeedd] text-gray-800">
      <Head>
        <title>{title}</title>
        <meta name="description" content="Yam platform" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="fixed top-0 left-0 right-0 h-16 z-10 bg-[#ffeedd]">
        <div className="container mx-auto px-6 h-full">
          <nav className={`flex justify-between items-center h-full`}>
            <Link href="/" className="text-xl font-[Spectral] font-bold tracking-tight lowercase pl-1 text-[#471803]">
              🍠 yam 
            </Link>
            <div className="flex">
              {isHomepage || isLoginPage ? (
                <Link href="/login" className="text-sm text-[#471803] px-4 py-2 ml-2 tracking-wide relative hover:border-b hover:border-[#471803] transition-colors">
                  login
                </Link>
              ) : isAuthenticated ? (
                <button 
                  onClick={handleSignOut}
                  className="text-sm text-[#471803] px-4 py-2 ml-2 tracking-wide relative hover:border-b hover:border-[#471803] transition-colors"
                >
                  signout
                </button>
              ) : (
                <Link href="/login" className="text-sm text-[#471803] px-4 py-2 ml-2 tracking-wide relative hover:border-b hover:border-[#471803] transition-colors">
                  login
                </Link>
              )}
              {/* <Link href="/about" className="text-sm text-[#471803] px-4 py-2 ml-2 tracking-wide relative hover:border-b hover:border-[#471803] transition-colors">
                about
              </Link> */}
              <a href="mailto:sales@useyam.com" className="text-sm text-[#471803] px-4 py-2 ml-2 mr-2 tracking-wide relative hover:border-b hover:border-[#471803] transition-colors">
                contact
              </a>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 pt-16 pb-12 flex flex-col">
        {glassy ? (
          <div className={`bg-[#fffaf5]/85 border-2 border-[#471803] shadow-sm p-12 fixed top-16 bottom-12 left-1/2 -translate-x-1/2 w-[85vw] overflow-y-auto`}>
            <div className="container mx-auto px-6">
              {children}
            </div>
          </div>
        ) : (
          <div className="fixed top-16 bottom-12 left-1/2 -translate-x-1/2 w-[85vw] border-6 border-[#471803]">
            <div className={`h-full overflow-y-auto px-6 ${isHomepage ? 'flex items-center justify-center' : ''}`}>
              {children}
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-12 flex items-center justify-center text-sm text-[#471803] bg-[#ffeedd]">
        {/* <div className="container mx-auto px-6 text-center">
          
        </div> */}
      </footer>
    </div>
  );
}