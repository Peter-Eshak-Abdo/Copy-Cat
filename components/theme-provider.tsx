"use client";

import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.colorScheme = t;
  if (t === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
  } else {
    root.classList.add("dark");
    root.classList.remove("light");
    root.setAttribute("data-theme", "dark");
  }
}

// Subscribe to storage events for cross-tab sync and local updates
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
  try {
    const savedTheme = localStorage.getItem("copycat-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
  } catch {}
  return "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem("copycat-theme", newTheme);
    } catch {}
    applyTheme(newTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
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

const emptySubscribe = () => () => {};

export function ThemeToggle({
  className = "",
  showLabel = false,
  compact = false,
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div
        className={`h-10 px-3 rounded-xl border border-slate-700/60 bg-slate-900/60 inline-flex items-center gap-1.5 ${className}`}
        aria-hidden="true"
      >
        <span className="w-4 h-4 rounded-full bg-slate-700 animate-pulse" />
        {showLabel && <span className="w-16 h-3 bg-slate-700 rounded animate-pulse" />}
      </div>
    );
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? "اضغط للتحويل إلى الوضع الليلي (Dark Mode)" : "اضغط للتحويل إلى الوضع الفاتح الواضح (Light Mode)"}
      className={`group relative inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] rounded-xl border transition-all duration-200 cursor-pointer select-none font-bold text-xs active:scale-95 ${
        isLight
          ? "bg-amber-50 hover:bg-amber-100/80 border-amber-300/80 text-amber-950 shadow-sm"
          : "bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-200 shadow-sm"
      } ${className}`}
      aria-label={isLight ? "تبديل إلى الوضع الليلي" : "تبديل إلى الوضع الفاتح"}
    >
      {isLight ? (
        <>
          <div className="w-5 h-5 rounded-lg bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
            <Sun className="w-3.5 h-3.5 text-amber-700 animate-spin-slow" />
          </div>
          {(showLabel || !compact) && (
            <span className="hidden sm:inline font-black text-amber-950">
              الوضع الفاتح
            </span>
          )}
        </>
      ) : (
        <>
          <div className="w-5 h-5 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
            <Moon className="w-3.5 h-3.5 text-blue-300" />
          </div>
          {(showLabel || !compact) && (
            <span className="hidden sm:inline font-bold text-slate-200">
              الوضع الليلي
            </span>
          )}
        </>
      )}
    </button>
  );
}

