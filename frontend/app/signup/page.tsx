"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { portalPath, useAuth, UserRole, getEnforcedRole } from "@/lib/AuthContext";
import { CheckCircle2, ShieldAlert, ArrowRight } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("coordinator");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !profile) return;
    router.replace(portalPath(profile.role));
  }, [authLoading, profile, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Guard: coordinator role only for RIT 24br emails
    const effectiveRole = getEnforcedRole(email, role);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: effectiveRole,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message || "Failed to create account. Please try again.");
        return;
      }

      // Check if email is already confirmed
      const isConfirmed = !!(data.user?.email_confirmed_at || data.user?.confirmed_at);

      if (!isConfirmed) {
        // Force sign out so Supabase doesn't auto-log them in
        await supabase.auth.signOut();
        setSuccessMsg(
          "Account created! Please check your email inbox (and spam folder) for a verification link. You must verify your email before signing in."
        );
        setFullName("");
        setEmail("");
        setPassword("");
      } else {
        setSuccessMsg("Account created successfully! Redirecting to your portal...");
        setTimeout(() => router.push(portalPath(effectiveRole)), 1500);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred during signup.");
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
              Create Your Account
            </h3>
            <p className="text-[11px] text-[#526070] mt-0.5">
              Register as a School Coordinator or Specialist Evaluator.
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

          {successMsg && (
            <div className="bg-[#E8F5E9] border border-[#C8E6C9] rounded-md p-3.5 text-xs text-[#2E7D32] space-y-1">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#2E7D32] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Check your email inbox</span>
                  <span className="leading-relaxed">{successMsg}</span>
                </div>
              </div>
            </div>
          )}

          {!successMsg && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#12243D] uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ananya Sharma or Dr. Marcus Vance"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md border border-[#D8D4CA] bg-white text-[#12243D] text-xs focus:outline-none focus:ring-2 focus:ring-[#12243D] focus:border-transparent placeholder:text-[#526070]/60"
                />
              </div>

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
                  RIT student accounts (24br...@rit.ac.in) are assigned the Coordinator role.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#12243D] uppercase tracking-wider mb-1.5">
                  Target Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("coordinator")}
                    className={`py-2.5 px-3 rounded-md border text-xs font-semibold transition ${
                      role === "coordinator"
                        ? "bg-[#12243D] text-white border-[#12243D] shadow-xs"
                        : "bg-white text-[#12243D] border-[#D8D4CA] hover:bg-[#F5F4F0]"
                    }`}
                  >
                    School Coordinator
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("special_educator")}
                    className={`py-2.5 px-3 rounded-md border text-xs font-semibold transition ${
                      role === "special_educator"
                        ? "bg-[#12243D] text-white border-[#12243D] shadow-xs"
                        : "bg-white text-[#12243D] border-[#D8D4CA] hover:bg-[#F5F4F0]"
                    }`}
                  >
                    Specialist Evaluator
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#12243D] uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Create password"
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
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="pt-3 border-t border-[#D8D4CA]/60 text-center text-xs text-[#526070]">
            Already registered?{" "}
            <Link href="/login" className="text-[#12243D] font-semibold hover:text-[#A6790C] hover:underline">
              Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
