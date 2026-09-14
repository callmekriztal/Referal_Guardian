"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export function HeaderNav() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  return (
    <header className="bg-[#12243D] text-white border-b border-[#12243D] sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Wordmark & Subtitle */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-[#A6790C] text-white flex items-center justify-center font-serif font-bold text-lg shadow-2xs">
            RG
          </div>
          <div className="flex flex-col">
            <Link
              href="/"
              className="font-serif text-lg font-semibold tracking-tight text-white hover:text-[#F5F4F0] transition focus:outline-none focus:ring-2 focus:ring-[#A6790C] rounded px-1 -ml-1"
            >
              Referral Guardian
            </Link>
            <span className="text-[11px] text-[#D8D4CA] font-medium tracking-normal">
              Student Referral Tracking
            </span>
          </div>
        </div>

        {/* Navigation Portals & Auth */}
        <nav className="flex items-center space-x-3 text-sm font-medium">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded transition text-xs sm:text-sm border focus:outline-none focus:ring-2 focus:ring-[#A6790C] ${
              profile?.role === "coordinator"
                ? "bg-[#A6790C] text-white border-[#8C660A] font-semibold"
                : "bg-[#1E324D] text-[#D8D4CA] hover:bg-[#253D5C] border-[#253D5C]"
            }`}
          >
            Coordinator Portal
          </Link>

          <Link
            href="/educator"
            className={`px-3 py-1.5 rounded transition text-xs sm:text-sm border focus:outline-none focus:ring-2 focus:ring-[#A6790C] ${
              profile?.role === "special_educator"
                ? "bg-[#A6790C] text-white border-[#8C660A] font-semibold"
                : "bg-[#1E324D] text-[#D8D4CA] hover:bg-[#253D5C] border-[#253D5C]"
            }`}
          >
            Specialist Portal
          </Link>

          {profile ? (
            <div className="flex items-center space-x-2 bg-[#1E324D] px-3 py-1.5 rounded border border-[#253D5C]">
              <span className="text-xs text-white font-medium max-w-[150px] truncate">
                {profile.fullName}
              </span>
              <button
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
                className="text-xs text-[#D8D4CA] hover:text-white transition ml-2 font-medium focus:outline-none focus:ring-1 focus:ring-white rounded px-1"
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded bg-[#A6790C] hover:bg-[#8C660A] text-white transition text-xs font-semibold border border-[#8C660A] focus:outline-none focus:ring-2 focus:ring-[#A6790C]"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
