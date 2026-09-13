"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { portalPath, useAuth, getEnforcedRole } from "@/lib/AuthContext";

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
        setErrorMsg(error.message);
        return;
      }

      if (data?.user) {
        const storedRole = data.user.user_metadata?.role;
        const effectiveRole = getEnforcedRole(email, storedRole);
        router.push(portalPath(effectiveRole));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4 sm:px-6">
      {/* Official Register Document Header */}
      <div className="bg-[#12243D] text-white p-6 rounded-t-md border border-[#12243D]">
        <div className="text-xs font-medium text-[#D8D4CA] mb-1">
          RPwD Act 2016 Statutory Assessment Compliance System
        </div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-white">
          Sign in to Referral Guardian
        </h1>
        <p className="text-xs text-[#D8D4CA] mt-2 leading-relaxed">
          Access the official assessment register to track 20-day evaluation timelines, review specialist progress, and manage student referral files.
        </p>
      </div>

      {/* Form Container */}
      <div className="bg-white p-6 rounded-b-md border-x border-b border-[#D8D4CA] shadow-2xs space-y-6">
        <p className="text-xs text-[#526070] italic border-b border-[#D8D4CA] pb-3">
          All fields required unless marked optional.
        </p>

        {errorMsg && (
          <div className="bg-[#FBEBE8] border border-[#F3C4BD] p-4 rounded text-xs text-[#8C3B2E] space-y-1">
            <div className="font-semibold">Authentication failure</div>
            <div>{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#12243D]">
              Official email address
            </label>
            <input
              type="email"
              required
              placeholder="e.g. 24br02024@rit.ac.in or dr.vance@clinic.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D] focus:border-[#12243D]"
            />
            <p className="text-[11px] text-[#526070]">
              School coordinators must sign in with their RIT email address starting with 24br. Clinical specialists may use their registered professional email.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#12243D]">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="Enter your account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D] focus:border-[#12243D]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#A6790C] hover:bg-[#8C660A] text-white font-medium text-sm rounded border border-[#8C660A] transition focus:outline-none focus:ring-2 focus:ring-[#A6790C] disabled:opacity-50"
            >
              {loading ? "Verifying credentials..." : "Sign in to portal"}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-[#D8D4CA] flex items-center justify-between text-xs">
          <span className="text-[#526070]">Need to register a new account?</span>
          <Link href="/signup" className="text-[#12243D] font-semibold hover:underline">
            Register new account
          </Link>
        </div>
      </div>
    </div>
  );
}
