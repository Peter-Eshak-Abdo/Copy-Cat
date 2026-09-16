"use client";

import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { Sun } from "lucide-react";

type Theme = "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.colorScheme = "light";
  root.classList.add("light");
  root.classList.remove("dark");
  root.setAttribute("data-theme", "light");
}

const THEME_CHANGE_EVENT = "copycat-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function getSnapshot(): Theme {
  return "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyTheme();
    try {
      localStorage.setItem("copycat-theme", "light");
    } catch {}
  }, []);

  const setTheme = () => {
    applyTheme();
  };

  const toggleTheme = () => {
    applyTheme();
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export function ThemeToggle({
  className = "",
  showLabel = false,
  compact = false,
}: ThemeToggleProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold shadow-xs ${className}`}
      title="الوضع النهاري الفاتح (Light Mode)"
    >
      <Sun className="w-3.5 h-3.5 text-amber-500" />
      {(showLabel || !compact) && <span>نهاري</span>}
    </div>
  );
}
