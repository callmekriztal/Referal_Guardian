import type { Metadata } from "next";
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { HeaderNav } from "@/components/HeaderNav";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: "Referral Guardian — Statutory Assessment Compliance Platform",
  description: "Inclusive Education Referral Continuity & RPwD Act 2016 Compliance Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${sourceSerif.variable}`}>
      <body className="font-sans bg-[#F5F4F0] text-[#12243D] min-h-screen flex flex-col antialiased">
        <AuthProvider>
          <HeaderNav />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="bg-[#12243D] text-[#D8D4CA] border-t border-[#12243D] py-4 text-center text-xs">
            Referral Guardian &copy; 2026 — Official Statutory Assessment Compliance System (RPwD Act 2016)
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
