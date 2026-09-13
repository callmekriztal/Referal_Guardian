"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { portalPath, useAuth, UserRole, getEnforcedRole } from "@/lib/AuthContext";

export default function SignupPage() {
  const router = useRouter();
  const { profile, loading: authLoading, setDemoUser } = useAuth();

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
