"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface UserSession {
  email: string;
  role: "admin" | "staff";
  name: string;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  /** Engineer account: confirms InstaPay transfers, reviews the change log */
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * The server is the only source of truth: the session is an httpOnly cookie checked by proxy.ts and
 * /api/auth/me. This localStorage copy only paints the admin shell instantly; it is replaced by what
 * /api/auth/me says (or cleared) right after, so editing it in DevTools grants nothing.
 */
const STORAGE_KEY = "copycat_session";

function readCachedUser(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed?.email && (parsed.role === "admin" || parsed.role === "staff")) return parsed;
  } catch {}
  return null;
}

function needsSessionCheck(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return p.startsWith("/admin") || p.startsWith("/login");
}

function cacheUser(user: UserSession | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(readCachedUser);
  // Only the staff side needs the session; the storefront never asks
  const [loading, setLoading] = useState(needsSessionCheck);
  const router = useRouter();

  useEffect(() => {
    if (!needsSessionCheck()) return;
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => {
        if (!alive) return;
        if (res.ok) {
          const data = await res.json();
          const next: UserSession = { email: data.email, role: data.role, name: data.name };
          setUser(next);
          cacheUser(next);
        } else if (res.status === 401) {
          setUser(null);
          cacheUser(null);
        }
        // Other errors (offline, 5xx): keep the cached user, the next request will tell
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const login = async (emailInput: string, passInput: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim().toLowerCase(), password: passInput }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        const next: UserSession = { email: data.email, role: data.role, name: data.name };
        setUser(next);
        cacheUser(next);
        return { success: true };
      }
      return { success: false, error: data?.error || "الإيميل أو الباسورد غلط." };
    } catch {
      return { success: false, error: "مفيش اتصال بالسيرفر، جرب تاني." };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    cacheUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === "admin" }}>
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
