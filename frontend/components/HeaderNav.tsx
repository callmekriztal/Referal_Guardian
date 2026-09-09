"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { LogIn, LogOut, User, UserCheck } from "lucide-react";

export function HeaderNav() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 text-white p-2 rounded-lg font-bold text-lg shadow-sm">
            🛡️
          </div>
          <Link href="/" className="text-xl font-bold tracking-tight hover:text-indigo-300 transition">
            Referral Guardian
          </Link>
          <span className="bg-indigo-900/80 text-indigo-300 text-xs font-semibold px-2.5 py-0.5 rounded border border-indigo-700 hidden sm:inline">
            Continuity MVP
          </span>
        </div>

        {/* Portal tabs & Auth controls */}
        <nav className="flex items-center space-x-2 sm:space-x-4 text-sm font-medium">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 border text-xs sm:text-sm ${
              profile?.role === "coordinator"
                ? "bg-indigo-600 text-white border-indigo-500 shadow-xs font-semibold"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700"
            }`}
          >
            <span>📋</span>
            <span>Coordinator</span>
          </Link>

          <Link
            href="/educator"
            className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 border text-xs sm:text-sm ${
              profile?.role === "special_educator"
                ? "bg-purple-600 text-white border-purple-500 shadow-xs font-semibold"
                : "bg-purple-950/40 text-purple-300 hover:bg-purple-900/60 border-purple-800/60"
            }`}
          >
            <span>🎓</span>
            <span>Special Educator</span>
          </Link>

          {profile ? (
            <div className="flex items-center space-x-2 bg-slate-800/90 pl-3 pr-1.5 py-1 rounded-full border border-slate-700">
              <div className="flex items-center space-x-1.5">
                {profile.role === "special_educator" ? (
                  <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                ) : (
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span className="text-xs text-slate-200 max-w-[130px] truncate font-medium">
                  {profile.fullName}
                </span>
              </div>
              <button
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
                className="p-1 text-slate-400 hover:text-rose-400 rounded-full transition ml-1"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition text-xs font-semibold flex items-center space-x-1 shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
