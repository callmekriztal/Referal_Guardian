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
}

export function portalPath(role: UserRole) {
  return role === "special_educator" ? "/educator" : "/";
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "coordinator" || value === "special_educator";
}

export function isStudentCoordinatorEmail(email: string): boolean {
  if (!email) return false;
  return /^24br[a-zA-Z0-9]{5}@rit\.ac\.in$/i.test(email.trim());
}

export function getEnforcedRole(email: string, requestedRole: UserRole): UserRole {
  if (isStudentCoordinatorEmail(email)) {
    return "coordinator";
  }
  return requestedRole;
}

function profileFromUser(user: User, fallbackRole: UserRole = "coordinator"): UserProfile {
  const email = user.email || "";
  const metaRole = user.user_metadata?.role;
  const baseRole = isUserRole(metaRole) ? metaRole : fallbackRole;
  const role = getEnforcedRole(email, baseRole);
  return {
    id: user.id,
    email,
    role,
    fullName: user.user_metadata?.full_name || email.split("@")[0] || "User",
  };
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((next: Session | null) => {
    setSession(next);
    setUser(next?.user ?? null);
    setProfile(next?.user ? profileFromUser(next.user) : null);
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        applySession(data.session);
      } catch (err) {
        console.warn("Supabase session check failed:", err);
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
    setUser(null);
    setSession(null);
    setProfile(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors on sign out
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
