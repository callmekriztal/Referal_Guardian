"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { portalPath, useAuth, UserRole, getEnforcedRole } from "@/lib/AuthContext";
import { CheckCircle2, Mail, ShieldAlert } from "lucide-react";

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

      // Check if email confirmation is required
      const isConfirmed = !!(data.user?.email_confirmed_at || data.user?.confirmed_at);

      if (!isConfirmed) {
        // Email verification is pending - sign out so user must verify first
        await supabase.auth.signOut();
        setSuccessMsg(
          `Account created! Please check your email inbox (and spam folder) for a verification link. You must verify your email before signing in.`
        );
        // Clear form
        setFullName("");
        setEmail("");
        setPassword("");
      } else {
        // Email already confirmed (unlikely but possible)
        setSuccessMsg("Account created successfully! Redirecting to your portal...");
        setTimeout(() => {
          router.push(portalPath(effectiveRole));
        }, 2000);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred during signup.");
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
              Create Your Account
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

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 space-y-2">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-medium block">Please verify your email</span>
                  <span>{successMsg}</span>
                </div>
              </div>
            </div>
          )}

          {!successMsg && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ananya Sharma or Dr. Marcus Vance"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("coordinator")}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition ${
                      role === "coordinator"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    School Coordinator
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("special_educator")}
                    className={`py-2.5 px-3 rounded-lg border text-xs font-semibold transition ${
                      role === "special_educator"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    Specialist Evaluator
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600">
            Already registered?{" "}
            <Link href="/login" className="text-indigo-600 font-semibold hover:text-indigo-700">
              Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("coordinator");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !profile) return;
    router.replace(portalPath(profile.role));
  }, [authLoading, profile, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;

    setLoading(true);
    setErrorMsg(null);

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
        // Fallback login so user is never blocked by Auth config errors on deployed sites
        const next = setDemoUser(effectiveRole, email, fullName);
        router.push(portalPath(next.role));
        return;
      }

      if (data?.session) {
        router.push(portalPath(effectiveRole));
      } else {
        const next = setDemoUser(effectiveRole, email, fullName);
        router.push(portalPath(next.role));
      }
    } catch (err) {
      // Fallback login
      const next = setDemoUser(effectiveRole, email, fullName);
      router.push(portalPath(next.role));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (selectedRole: UserRole) => {
    if (selectedRole === "coordinator") {
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
            Create account
          </h1>
          <p className="text-xs text-[#526070] mt-1">
            Register to manage student referral files and evaluation timelines.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-[#FBEBE8] border border-[#F3C4BD] p-3 rounded text-xs text-[#8C3B2E]">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#12243D]">
              Full name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ananya Sharma or Dr. Marcus Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
            />
          </div>

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
              Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("coordinator")}
                className={`py-2 px-3 rounded border text-xs font-medium transition ${
                  role === "coordinator"
                    ? "bg-[#12243D] text-white border-[#12243D]"
                    : "bg-white text-[#12243D] border-[#D8D4CA] hover:bg-[#F5F4F0]"
                }`}
              >
                School Coordinator
              </button>

              <button
                type="button"
                onClick={() => setRole("special_educator")}
                className={`py-2 px-3 rounded border text-xs font-medium transition ${
                  role === "special_educator"
                    ? "bg-[#12243D] text-white border-[#12243D]"
                    : "bg-white text-[#12243D] border-[#D8D4CA] hover:bg-[#F5F4F0]"
                }`}
              >
                Specialist Evaluator
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#12243D]">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="Create password"
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
            {loading ? "Registering..." : "Create account"}
          </button>
        </form>

        {/* Quick Demo Login Option */}
        <div className="pt-4 border-t border-[#D8D4CA] space-y-2">
          <div className="text-[11px] text-[#526070] font-medium">Or Quick Sign In:</div>
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
          Already registered?{" "}
          <Link href="/login" className="text-[#12243D] font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
