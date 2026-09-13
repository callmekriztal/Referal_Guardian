"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { portalPath, useAuth, UserRole, isStudentCoordinatorEmail, getEnforcedRole } from "@/lib/AuthContext";

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

    // Guard: Prevent signup as coordinator if email is not a 24br RIT email
    if (role === "coordinator" && !isStudentCoordinatorEmail(email)) {
      setErrorMsg("School coordinator access requires an RIT student account starting with 24br (e.g., 24br02024@rit.ac.in). Specialists may register with any valid professional email.");
      setLoading(false);
      return;
    }

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

      if (data?.session) {
        router.push(portalPath(effectiveRole));
      } else {
        setSuccessMsg("Account created successfully. Please verify your email or sign in below.");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An error occurred during account creation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4 sm:px-6">
      {/* Header Register Card */}
      <div className="bg-[#12243D] text-white p-6 rounded-t-md border border-[#12243D]">
        <div className="text-xs font-medium text-[#D8D4CA] mb-1">
          RPwD Act 2016 Statutory Assessment Compliance System
        </div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-white">
          Register new account
        </h1>
        <p className="text-xs text-[#D8D4CA] mt-2 leading-relaxed">
          Create an official access record to manage student evaluation files or record specialist diagnostic findings.
        </p>
      </div>

      <div className="bg-white p-6 rounded-b-md border-x border-b border-[#D8D4CA] shadow-2xs space-y-6">
        <p className="text-xs text-[#526070] italic border-b border-[#D8D4CA] pb-3">
          All fields required unless marked optional.
        </p>

        {errorMsg && (
          <div className="bg-[#FBEBE8] border border-[#F3C4BD] p-4 rounded text-xs text-[#8C3B2E] space-y-1">
            <div className="font-semibold">Registration requirement notice</div>
            <div>{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="bg-[#EBF3ED] border border-[#BBD5C0] p-4 rounded text-xs text-[#4B6A52] space-y-1">
            <div className="font-semibold">Registration complete</div>
            <div>{successMsg}</div>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#12243D]">
              Full legal name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ananya Sharma or Dr. Marcus Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#12243D]">
              Official email address
            </label>
            <input
              type="email"
              required
              placeholder="e.g. 24br02024@rit.ac.in or doctor@clinic.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#12243D]">
              Account role selection
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("coordinator")}
                className={`p-3 rounded border text-left text-xs transition ${
                  role === "coordinator"
                    ? "border-[#12243D] bg-[#12243D] text-white font-semibold"
                    : "border-[#D8D4CA] bg-white text-[#12243D] hover:bg-[#F5F4F0]"
                }`}
              >
                <div className="font-semibold text-sm">School Coordinator</div>
                <div className="text-[11px] opacity-80 mt-1">Manages 20-day statutory assessment timelines (Requires 24br RIT email)</div>
              </button>

              <button
                type="button"
                onClick={() => setRole("special_educator")}
                className={`p-3 rounded border text-left text-xs transition ${
                  role === "special_educator"
                    ? "border-[#12243D] bg-[#12243D] text-white font-semibold"
                    : "border-[#D8D4CA] bg-white text-[#12243D] hover:bg-[#F5F4F0]"
                }`}
              >
                <div className="font-semibold text-sm">Specialist Evaluator</div>
                <div className="text-[11px] opacity-80 mt-1">Psychologists, Speech Therapists, & OTs logging evaluation notes</div>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#12243D]">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="Create account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 bg-white border border-[#D8D4CA] rounded text-[#12243D] focus:outline-none focus:ring-2 focus:ring-[#12243D]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#A6790C] hover:bg-[#8C660A] text-white font-medium text-sm rounded border border-[#8C660A] transition focus:outline-none focus:ring-2 focus:ring-[#A6790C] disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Register account"}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-[#D8D4CA] flex items-center justify-between text-xs">
          <span className="text-[#526070]">Already registered?</span>
          <Link href="/login" className="text-[#12243D] font-semibold hover:underline">
            Sign in to existing account
          </Link>
        </div>
      </div>
    </div>
  );
}
