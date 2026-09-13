"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type UserRole = "coordinator" | "special_educator";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  isDemo?: boolean;
}

export function portalPath(role: UserRole) {
  return role === "special_educator" ? "/educator" : "/";
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "coordinator" || value === "special_educator";
}

export function isStudentCoordinatorEmail(email: string): boolean {
  if (!email) return false;
  return /^24br[a-zA-Z0-9]+@rit\.ac\.in$/i.test(email.trim());
}

export function getEnforcedRole(email: string, fallbackRole: UserRole = "coordinator"): UserRole {
  if (isStudentCoordinatorEmail(email)) {
    return "coordinator";
  }
  return fallbackRole;
}

function profileFromUser(user: User): UserProfile {
  const email = user.email || "";
  const metaRole = user.user_metadata?.role;
  const baseRole = isUserRole(metaRole) ? metaRole : (isStudentCoordinatorEmail(email) ? "coordinator" : "special_educator");
  const role = getEnforcedRole(email, baseRole);
  return {
    id: user.id,
    email,
    role,
    fullName: user.user_metadata?.full_name || email.split("@")[0] || "User",
  };
}

function readStoredProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("rg_profile");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && isUserRole(parsed.role)) {
      return parsed;
    }
  } catch {
    // Ignore invalid JSON
  }
  return null;
}

function writeStoredProfile(profile: UserProfile | null) {
  if (typeof window === "undefined") return;
  if (!profile) {
    localStorage.removeItem("rg_profile");
  } else {
    localStorage.setItem("rg_profile", JSON.stringify(profile));
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setDemoUser: (role: UserRole, email: string, name: string) => UserProfile;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  setDemoUser: () => ({
    id: "demo",
    email: "demo@school.org",
    role: "coordinator",
    fullName: "Coordinator",
    isDemo: true,
  }),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((next: Session | null) => {
    setSession(next);
    setUser(next?.user ?? null);
    if (next?.user) {
      const p = profileFromUser(next.user);
      setProfile(p);
      writeStoredProfile(p);
    } else {
      const stored = readStoredProfile();
      setProfile(stored);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        applySession(data.session);
      } catch (err) {
        console.warn("Supabase session check failed, falling back to local state:", err);
        if (mounted) setProfile(readStoredProfile());
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      applySession(next);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signOut = async () => {
    writeStoredProfile(null);
    setUser(null);
    setSession(null);
    setProfile(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors
    }
  };

  const setDemoUser = (role: UserRole, email: string, name: string): UserProfile => {
    const next: UserProfile = {
      id: `local-${Date.now()}`,
      email,
      role,
      fullName: name,
      isDemo: true,
    };
    setUser(null);
    setSession(null);
    setProfile(next);
    writeStoredProfile(next);
    return next;
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, setDemoUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
