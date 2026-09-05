"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, description?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, description?: string) => void;
    error: (message: string, description?: string) => void;
    warning: (message: string, description?: string) => void;
    info: (message: string, description?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, description?: string, duration = 4500) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, message, description, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toastMethods = useMemo(
    () => ({
      success: (message: string, description?: string) => showToast("success", message, description),
      error: (message: string, description?: string) => showToast("error", message, description),
      warning: (message: string, description?: string) => showToast("warning", message, description),
      info: (message: string, description?: string) => showToast("info", message, description),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, toast: toastMethods }}>
      {children}
      {/* Fixed Toast Container positioned top-center / bottom-left with RTL awareness */}
      <div
        aria-live="polite"
        className="fixed bottom-5 left-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        dir="rtl"
      >
        {toasts.map((t) => {
          let bgClass = "bg-slate-900/95 border-slate-700 text-slate-100";
          let icon = <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />;
          let barClass = "bg-blue-500";

          if (t.type === "success") {
            bgClass = "bg-emerald-950/95 border-emerald-500/40 text-emerald-50";
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />;
            barClass = "bg-emerald-500";
          } else if (t.type === "error") {
            bgClass = "bg-rose-950/95 border-rose-500/40 text-rose-50";
            icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />;
            barClass = "bg-rose-500";
          } else if (t.type === "warning") {
            bgClass = "bg-amber-950/95 border-amber-500/40 text-amber-50";
            icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />;
            barClass = "bg-amber-500";
          }

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-3 fade-in ${bgClass}`}
            >
              <div
                className={`absolute top-0 right-0 left-0 h-1 opacity-70 ${barClass}`}
              />
              <div className="flex items-start gap-3">
                {icon}
                <div className="flex-1 text-right">
                  <p className="text-sm font-bold leading-tight">{t.message}</p>
                  {t.description && (
                    <p className="text-xs opacity-80 mt-1 leading-relaxed">{t.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="opacity-70 hover:opacity-100 transition p-1 rounded-lg hover:bg-white/10 text-current cursor-pointer"
                  aria-label="إغلاق التنبيه"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return {
    ...context,
    ...context.toast,
    success: context.toast.success,
    error: context.toast.error,
    warning: context.toast.warning,
    info: context.toast.info,
  };
}
