"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export interface UserSession {
  email: string;
  role: "admin" | "staff";
  name: string;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MASTER_EMAIL = process.env.NEXT_PUBLIC_MASTER_EMAIL || "";
const STORAGE_KEY = "copycat_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.email) return parsed;
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    // Check Supabase auth state if available
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user?.email) {
          const userObj: UserSession = {
            email: session.user.email,
            role: session.user.email === MASTER_EMAIL ? "admin" : "staff",
            name: session.user.user_metadata?.full_name || session.user.email.split("@")[0],
          };
          setUser(userObj);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(userObj));
          } catch {}
        }
      })
      .catch(() => {
        // Supabase offline/not configured
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        const userObj: UserSession = {
          email: session.user.email,
          role: session.user.email === MASTER_EMAIL ? "admin" : "staff",
          name: session.user.user_metadata?.full_name || session.user.email.split("@")[0],
        };
        setUser(userObj);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(userObj));
        } catch {}
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (
    emailInput: string,
    passInput: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPass = passInput.trim();

    // Verification 1: Server-side Designated Master Admin (keys protected in .env)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
      });
      const data = await res.json();
      if (data?.isMaster && data?.success) {
        const adminUser: UserSession = {
          email: data.email || MASTER_EMAIL,
          role: "admin",
          name: data.name || "مدير كوبي كات",
        };
        setUser(adminUser);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(adminUser));
          document.cookie = `copycat_auth=admin; path=/; max-age=86400; SameSite=Lax`;
        } catch {}
        return { success: true };
      }
    } catch (err) {
      console.warn("Server-side master check skipped/failed:", err);
    }

    // Verification 2: Supabase Auth
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPass,
        });

        if (!error && data?.user?.email) {
          const staffUser: UserSession = {
            email: data.user.email,
            role: data.user.email === MASTER_EMAIL ? "admin" : "staff",
            name: data.user.user_metadata?.full_name || data.user.email.split("@")[0],
          };
          setUser(staffUser);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(staffUser));
            document.cookie = `copycat_auth=staff; path=/; max-age=86400; SameSite=Lax`;
          } catch {}
          return { success: true };
        }

        if (error) {
          return {
            success: false,
            error: "بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور.",
          };
        }
      } catch (err: unknown) {
        console.warn("Supabase auth error:", err);
      }
    }

    return {
      success: false,
      error: "بيانات الدخول غير صحيحة. يرجى التأكد من كتابة البريد وكلمة المرور بدقة.",
    };
  };

  const loginWithGoogle = async () => {
    try {
      const redirectUrl =
        typeof window !== "undefined" ? `${window.location.origin}/admin` : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) {
        throw error;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تسجيل الدخول بجوجل";
      console.warn("Google OAuth Note:", msg);
      throw new Error(`تعذر تسجيل الدخول بجوجل: ${msg}. يرجى التحقق من إعدادات Supabase.`);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      document.cookie = "copycat_auth=; path=/; max-age=0";
    } catch {}
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        logout,
        isAdmin: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
