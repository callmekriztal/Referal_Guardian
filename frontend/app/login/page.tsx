"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { portalPath, useAuth, getEnforcedRole } from "@/lib/AuthContext";
import { ShieldAlert, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !profile) return;
    router.replace(portalPath(profile.role));
  }, [authLoading, profile, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          setErrorMsg("Please verify your email address before logging in. Check your inbox (and spam folder) for the verification link.");
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

      if (data?.user) {
        const isConfirmed = !!(data.user.email_confirmed_at || data.user.confirmed_at);
        if (!isConfirmed) {
          await supabase.auth.signOut();
          setErrorMsg("Please verify your email address before logging in. Check your inbox (and spam folder) for the verification link.");
          return;
        }
        const storedRole = data.user.user_metadata?.role;
        const effectiveRole = getEnforcedRole(email, storedRole);
        router.push(portalPath(effectiveRole));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred during sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-6 px-4">
      <div className="max-w-md w-full space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#A6790C] text-white font-serif font-bold text-2xl shadow-sm">
            RG
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[#12243D]">
            Referral Guardian Portal
          </h1>
          <p className="text-xs text-[#526070] max-w-sm mx-auto">
            Statutory Assessment Compliance & Referral Tracking System (RPwD Act 2016)
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white p-7 rounded-lg border border-[#D8D4CA] shadow-sm space-y-5">
          <div className="border-b border-[#D8D4CA]/60 pb-3">
            <h3 className="text-xs font-bold text-[#12243D] uppercase tracking-wider">
              Sign In to Your Account
            </h3>
            <p className="text-[11px] text-[#526070] mt-0.5">
              Access coordinator monitoring or specialist assessment records.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-[#FBEBE8] border border-[#F3C4BD] rounded-md p-3.5 text-xs text-[#8C3B2E] space-y-1">
              <div className="flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#8C3B2E] shrink-0 mt-0.5" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#12243D] uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="e.g. 24br02024@rit.ac.in or doctor@clinic.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-md border border-[#D8D4CA] bg-white text-[#12243D] text-xs focus:outline-none focus:ring-2 focus:ring-[#12243D] focus:border-transparent placeholder:text-[#526070]/60"
              />
              <p className="text-[10px] text-[#526070] mt-1">
                Coordinators must sign in using their RIT account (24br...@rit.ac.in).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#12243D] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-md border border-[#D8D4CA] bg-white text-[#12243D] text-xs focus:outline-none focus:ring-2 focus:ring-[#12243D] focus:border-transparent placeholder:text-[#526070]/60"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#A6790C] hover:bg-[#8C660A] text-white font-semibold text-xs rounded-md transition focus:outline-none focus:ring-2 focus:ring-[#A6790C] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-[#D8D4CA]/60 text-center text-xs text-[#526070]">
            Don't have an account?{" "}
            <Link href="/signup" className="text-[#12243D] font-semibold hover:text-[#A6790C] hover:underline">
              Create one here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
