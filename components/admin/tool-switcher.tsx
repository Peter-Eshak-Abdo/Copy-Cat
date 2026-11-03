"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Home, Search, X } from "lucide-react";
import { visibleTools, type AdminTool } from "@/lib/admin-tools";
import { useAuth } from "@/lib/auth";

/** Arabic search that ignores hamza/ta-marbuta/ya differences and diacritics */
export function normalizeArabic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

export function toolMatches(tool: AdminTool, query: string): boolean {
  const q = normalizeArabic(query);
  if (!q) return true;
  const hay = normalizeArabic(`${tool.title} ${tool.short} ${tool.desc} ${tool.badge} ${tool.keywords}`);
  return q.split(/\s+/).every((word) => hay.includes(word));
}

/**
 * Ctrl+K (or the search button in the top bar) opens a quick list of every tool.
 * Type a few letters, arrows to move, Enter to open.
 */
export function ToolSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  // The panel mounts fresh on every open, so the search box always starts empty
  return <AnimatePresence>{open && <SwitcherPanel onClose={onClose} />}</AnimatePresence>;
}

function SwitcherPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const tools = visibleTools(isAdmin).filter((t) => toolMatches(t, query));
    return [{ id: "home", short: "كل الأدوات (الرئيسية)", href: "/admin", tool: null as AdminTool | null }]
      .filter(() => !query.trim())
      .concat(tools.map((t) => ({ id: t.id, short: t.title, href: t.href, tool: t })));
  }, [query, isAdmin]);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) go(r.href);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
        <motion.div
          className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          dir="rtl"
        >
          <motion.div
            role="dialog"
            aria-label="افتح أداة"
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="اكتب اسم الأداة... (بطاقة، PDF، صور، حاسبة)"
                className="flex-1 bg-transparent border-0 outline-none focus:shadow-none text-base font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium"
              />
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="اقفل"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ul className="max-h-[55vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <li className="py-10 text-center text-sm font-bold text-slate-400">مفيش أداة بالاسم ده</li>
              )}
              {results.map((r, i) => {
                const Icon = r.tool?.icon ?? Home;
                const isActive = i === active;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r.href)}
                      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right cursor-pointer ${
                        isActive ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="switcher-active"
                          className="absolute inset-0 rounded-xl bg-blue-50 border border-blue-100"
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        />
                      )}
                      <span
                        className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          r.tool ? r.tool.solidTile : "bg-slate-900 text-white"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="relative flex-1 min-w-0">
                        <span className="block text-sm font-black truncate">{r.short}</span>
                        {r.tool && (
                          <span className="block text-xs text-slate-500 font-medium truncate">{r.tool.desc}</span>
                        )}
                      </span>
                      {isActive && <CornerDownLeft className="relative w-4 h-4 text-blue-500 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-500">
              <span>↑ ↓ للتنقل · Enter للفتح · Esc للقفل</span>
              <span dir="ltr" className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200">Ctrl + K</span>
            </div>
          </motion.div>
        </motion.div>
  );
}
