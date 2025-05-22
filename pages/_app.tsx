import "@/styles/globals.css";

import { Analytics } from "@vercel/analytics/next"
import type { AppProps } from "next/app";
import { AuthProvider } from "@/context/AuthContext";
import { Spectral } from 'next/font/google';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "@/components/ui/sonner"

const spectral = Spectral({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-spectral'
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <main className={`${spectral.variable}`}>
         <Component {...pageProps} />
         <SpeedInsights />
         <Analytics />
      </main>
      <Toaster />
    </AuthProvider>
  );
}
