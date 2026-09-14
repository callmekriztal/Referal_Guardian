"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { portalPath, useAuth, UserRole, getEnforcedRole } from "@/lib/AuthContext";
import { CheckCircle2, ShieldAlert } from "lucide-react";

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

      // Check if email is already confirmed (unusual but handle it)
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
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 bg-slate-50/50">
      <div className="max-w-md w-full space-y-6">

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white text-3xl shadow-lg shadow-indigo-500/20">
            🛡️
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create Guardian Account
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Join as a School Coordinator or Special Educator
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Create Your Account
            </h3>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900">
              <div className="flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-medium block">Check your email inbox</span>
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
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  RIT students (24br...@rit.ac.in) are automatically assigned the Coordinator role.
                </p>
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
                  minLength={6}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

          <div className="pt-3 border-t border-slate-100 text-center text-xs text-slate-600">
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
