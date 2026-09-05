"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("copycat-theme") as Theme | null;
      if (savedTheme === "light" || savedTheme === "dark") {
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      } else {
        applyTheme("dark");
      }
    } catch {
      applyTheme("dark");
    }
  }, []);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    if (t === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
      root.setAttribute("data-theme", "dark");
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("copycat-theme", newTheme);
    } catch {
      // ignore
    }
    applyTheme(newTheme);
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

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "dark" ? "التحويل للوضع الفاتح (Light Mode)" : "التحويل للوضع الليلي (Dark Mode)"}
      className={`relative inline-flex items-center justify-center p-2.5 rounded-xl border transition-all duration-300 ${
        theme === "light"
          ? "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 shadow-sm"
          : "bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700/80 hover:text-amber-200 shadow-sm shadow-blue-500/5"
      } ${className}`}
      aria-label="تبديل مظهر الموقع"
    >
      {theme === "light" ? (
        <Moon className="w-4 h-4 transition-transform duration-300 hover:-rotate-12 text-slate-700" />
      ) : (
        <Sun className="w-4 h-4 transition-transform duration-300 hover:rotate-45 text-amber-400" />
      )}
    </button>
  );
}
