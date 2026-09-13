"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { LogIn, LogOut, User, UserCheck, Shield } from "lucide-react";

export function HeaderNav() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 text-white p-2 rounded-md flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <Link href="/" className="text-lg font-bold tracking-tight text-white hover:text-slate-200 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded">
              Referral Guardian
            </Link>
            <span className="text-[10px] text-slate-400 font-medium">
              RPwD Act Statutory Assessment Continuity
            </span>
          </div>
        </div>

        <nav className="flex items-center space-x-3 text-sm font-medium">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-md transition flex items-center space-x-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              profile?.role === "coordinator"
                ? "bg-indigo-600 text-white font-semibold shadow-xs"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
            }`}
          >
            <span>Coordinator Portal</span>
          </Link>

          <Link
            href="/educator"
            className={`px-3 py-1.5 rounded-md transition flex items-center space-x-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              profile?.role === "special_educator"
                ? "bg-purple-600 text-white font-semibold shadow-xs"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
            }`}
          >
            <span>Specialist Portal</span>
          </Link>

          {profile ? (
            <div className="flex items-center space-x-2 bg-slate-800 pl-3 pr-2 py-1 rounded-md border border-slate-700">
              <div className="flex items-center space-x-1.5">
                {profile.role === "special_educator" ? (
                  <UserCheck className="w-4 h-4 text-purple-400" />
                ) : (
                  <User className="w-4 h-4 text-indigo-400" />
                )}
                <span className="text-xs text-slate-200 max-w-[140px] truncate font-medium">
                  {profile.fullName}
                </span>
              </div>
              <button
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
                className="p-1 text-slate-400 hover:text-rose-400 rounded transition ml-1 focus:outline-none focus:ring-2 focus:ring-rose-500"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition text-xs font-semibold flex items-center space-x-1 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
