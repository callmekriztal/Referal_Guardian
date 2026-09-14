"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { portalPath, useAuth, getEnforcedRole } from "@/lib/AuthContext";
import { Lock, Mail, ShieldAlert, ArrowRight } from "lucide-react";

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
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 bg-slate-50/50">
      <div className="max-w-md w-full space-y-6">

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white text-3xl shadow-lg shadow-indigo-500/20">
            🛡️
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Referral Guardian Portal
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            AI-Powered Special Education Referral Tracking & Bottleneck Prevention System
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Sign In to Your Account
            </h3>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-2">
              <div className="flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="e.g. 24br02024@rit.ac.in or doctor@clinic.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600">
            Don't have an account?{" "}
            <Link href="/signup" className="text-indigo-600 font-semibold hover:text-indigo-700">
              Create one here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        // If Supabase API rejects or fails, use local profile fallback so user is never blocked
        const role = getEnforcedRole(email, "coordinator");
        const next = setDemoUser(role, email, email.split("@")[0] || "User");
        router.push(portalPath(next.role));
        return;
      }

      if (data?.user) {
        const storedRole = data.user.user_metadata?.role;
        const effectiveRole = getEnforcedRole(email, storedRole);
        router.push(portalPath(effectiveRole));
      }
    } catch (err) {
      // Resilient fallback
      const role = getEnforcedRole(email, "coordinator");
      const next = setDemoUser(role, email, email.split("@")[0] || "User");
      router.push(portalPath(next.role));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: UserRole) => {
    if (role === "coordinator") {
      const next = setDemoUser("coordinator", "24br02024@rit.ac.in", "Student Coordinator");
      router.push(portalPath(next.role));
    } else {
      const next = setDemoUser("special_educator", "dr.vance@clinic.org", "Dr. Marcus Vance");
      router.push(portalPath(next.role));
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
      <div className="bg-white p-8 rounded border border-[#D8D4CA] shadow-2xs space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-[#12243D]">
            Sign in
          </h1>
          <p className="text-xs text-[#526070] mt-1">
            Access your student referral tracking workspace.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-[#FBEBE8] border border-[#F3C4BD] p-3.5 rounded text-xs text-[#8C3B2E]">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#12243D]">
              Email address
            </label>
            <input
              type="email"
              required
              placeholder="e.g. 24br02024@rit.ac.in or doctor@clinic.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#12243D]">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#A6790C] hover:bg-[#8C660A] text-white font-medium text-xs rounded transition focus:outline-none focus:ring-2 focus:ring-[#A6790C] disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Quick Demo Login Option */}
        <div className="pt-4 border-t border-[#D8D4CA] space-y-2">
          <div className="text-[11px] text-[#526070] font-medium">Quick One-Click Sign In:</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin("coordinator")}
              className="px-3 py-2 text-xs bg-[#F5F4F0] hover:bg-[#EBE8DF] text-[#12243D] font-medium rounded border border-[#D8D4CA] transition"
            >
              As Coordinator
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin("special_educator")}
              className="px-3 py-2 text-xs bg-[#F5F4F0] hover:bg-[#EBE8DF] text-[#12243D] font-medium rounded border border-[#D8D4CA] transition"
            >
              As Specialist
            </button>
          </div>
        </div>

        <div className="pt-2 text-center text-xs text-[#526070]">
          Don't have an account?{" "}
          <Link href="/signup" className="text-[#12243D] font-semibold hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
