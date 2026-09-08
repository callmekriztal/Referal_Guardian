"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { portalPath, useAuth, UserRole, isStudentCoordinatorEmail, getEnforcedRole } from "@/lib/AuthContext";
import { Lock, Mail, ShieldAlert, ArrowRight, User, CheckCircle2, Sparkles, ClipboardList, GraduationCap, Check } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { setDemoUser, profile, loading: authLoading } = useAuth();

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

  const isRitStudent = isStudentCoordinatorEmail(email);

  const handleQuickDemo = (demoRole: UserRole) => {
    if (demoRole === "coordinator") {
      setDemoUser("coordinator", "24br02024@rit.ac.in", "Student Coordinator (24br02024@rit.ac.in)");
    } else {
      setDemoUser("special_educator", "dr.vance@clinic.org", "Dr. Marcus Vance (Special Educator)");
    }
    router.push(portalPath(demoRole));
  };

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
        setErrorMsg(error.message);
        return;
      }

      if (data.session) {
        setSuccessMsg("Account created. Redirecting to your portal…");
        router.push(portalPath(effectiveRole));
        return;
      }

      setSuccessMsg(
        "Account created. Confirm your email if required, then sign in with the same password."
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 bg-slate-50/50">
      <div className="max-w-md w-full space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white text-3xl shadow-lg shadow-indigo-500/20">
            🛡️
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create Guardian Account
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Join as a School Coordinator or Special Educator (Supabase Auth)
          </p>
        </div>

        {/* Instant Demo Access Box */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white p-4.5 rounded-2xl shadow-md border border-indigo-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <h2 className="text-xs font-bold text-white tracking-wide uppercase">
                Skip Signup & Enter Instant Demo
              </h2>
            </div>
            <span className="text-[10px] font-extrabold bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full uppercase">
              No Password
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => handleQuickDemo("coordinator")}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-indigo-950 rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5 border border-white/80"
            >
              <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
              <span>Coordinator</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo("special_educator")}
              className="px-3 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5 border border-purple-400/80"
            >
              <GraduationCap className="w-3.5 h-3.5 text-purple-100" />
              <span>Special Educator</span>
            </button>
          </div>
        </div>

        {/* Signup Form Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-2">
              <div className="flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              <div className="pt-1 border-t border-rose-200/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleQuickDemo(role)}
                  className="text-[11px] font-bold text-indigo-700 hover:underline flex items-center gap-1"
                >
                  <span>Bypass and Enter as Demo {role === "coordinator" ? "Coordinator" : "Special Educator"}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Select Your Role Persona *
              </label>
              {isRitStudent && (
                <div className="mb-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Verified RIT Student Coordinator — Role locked to Coordinator</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("coordinator")}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                    (isRitStudent || role === "coordinator")
                      ? "bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs font-bold"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  📋 Student Coordinator
                </button>
                <button
                  type="button"
                  disabled={isRitStudent}
                  onClick={() => setRole("special_educator")}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                    isRitStudent
                      ? "opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
                      : role === "special_educator"
                      ? "bg-purple-50 text-purple-700 border-purple-300 shadow-xs font-bold"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  🎓 Special Educator
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="Dr. Jane Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="name@school.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password (min 6 chars) *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              <span>{loading ? "Registering..." : "Create Account with Supabase"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="text-center pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Already registered?</span>
            <Link href="/login" className="text-indigo-600 font-bold hover:underline">
              Sign In →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
