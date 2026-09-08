"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isUserRole, portalPath, useAuth, UserRole, isStudentCoordinatorEmail, getEnforcedRole } from "@/lib/AuthContext";
import { Lock, Mail, ShieldAlert, ArrowRight, Sparkles, GraduationCap, ClipboardList, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setDemoUser, profile, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("coordinator");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setErrorMsg(null);

    const effectiveRole = getEnforcedRole(email, role);

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
        const metaRole = data.user.user_metadata?.role;
        const targetRole = getEnforcedRole(email, isUserRole(metaRole) ? metaRole : effectiveRole);
        if (!isUserRole(metaRole) || metaRole !== targetRole) {
          await supabase.auth.updateUser({ data: { role: targetRole } });
        }
        router.push(portalPath(targetRole));
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

        {/* Brand Header */}
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

        {/* Feature Banner: Instant Demo Access (No Password Required) */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white p-5 rounded-2xl shadow-md border border-indigo-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                Instant Demo Access (No Password)
              </h2>
            </div>
            <span className="text-[10px] font-extrabold bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full uppercase">
              Fast Track
            </span>
          </div>

          <p className="text-xs text-indigo-200">
            Evaluate Referral Guardian instantly with pre-seeded role personas without password authentication:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleQuickDemo("coordinator")}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-indigo-950 rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center space-x-2 border border-white/80 group"
            >
              <ClipboardList className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
              <span>School Coordinator</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo("special_educator")}
              className="px-3.5 py-2.5 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center space-x-2 border border-purple-400/80 group"
            >
              <GraduationCap className="w-4 h-4 text-purple-100 group-hover:scale-110 transition-transform" />
              <span>Special Educator</span>
            </button>
          </div>
        </div>

        {/* Supabase Password Sign In Form Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Or Sign In with Password (Supabase Auth)
            </h3>
            <span className="text-[10px] text-slate-400">Database Auth</span>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-2">
              <div className="flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMsg}</span>
              </div>
              <div className="pt-1 border-t border-rose-200/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleQuickDemo(role)}
                  className="text-[11px] font-bold text-indigo-700 hover:underline flex items-center gap-1"
                >
                  <span>Continue as Demo {role === "coordinator" ? "Coordinator" : "Special Educator"} instead</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Role Persona
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("coordinator")}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                    role === "coordinator"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  📋 School Coordinator
                </button>
                <button
                  type="button"
                  onClick={() => setRole("special_educator")}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                    role === "special_educator"
                      ? "bg-purple-50 text-purple-700 border-purple-300 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  🎓 Special Educator
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="dr.smith@school.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
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
              <span>{loading ? "Authenticating..." : "Sign In with Password"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="text-center pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Don't have an account yet?</span>
            <Link href="/signup" className="text-indigo-600 font-bold hover:underline">
              Create Account →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
