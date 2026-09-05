"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Camera,
  FileText,
  ScanLine,
  Boxes,
  LayoutDashboard,
  Home,
  LogOut,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-provider";

const navigation = [
  { name: "مركز التحكم والاسكربتات", href: "/admin", icon: LayoutDashboard },
  { name: "مصنع البطاقات والمستندات (A5)", href: "/admin/id-cards", icon: CreditCard },
  { name: "استوديو الصور الشخصية (4x6)", href: "/admin/passport-photos", icon: Camera },
  { name: "ماسح المستندات وتوفير الحبر", href: "/admin/scanner", icon: ScanLine },
  { name: "مولد الأبحاث الذكي", href: "/admin/research", icon: FileText },
  { name: "إدارة المخزن والكتالوج (حصر)", href: "/admin/inventory", icon: Boxes },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-slate-900/95 border-l border-slate-800 flex flex-col justify-between p-4 min-h-screen shrink-0 transition-colors duration-300">
      <div>
        {/* Branding */}
        <div className="flex items-center justify-between px-2 py-4 mb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex items-center justify-center p-0.5 border border-slate-700/50 shadow-lg shrink-0">
              <img src="/logo.jpg" alt="Copy Cat" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base leading-tight">كوبي كات</h1>
              <p className="text-xs text-blue-400 font-semibold">Copy-Cat ERP</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* User Info pill */}
        {user && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="truncate">
              <span className="text-slate-300 font-bold block truncate">{user.name}</span>
              <span className="text-slate-500 text-[10px] block truncate">{user.email}</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="space-y-1.5">
          <div className="px-3 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            أدوات واسكربتات العمل
          </div>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/80"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Actions */}
      <div className="pt-4 border-t border-slate-800 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
        >
          <Home className="w-4 h-4 text-slate-400" />
          <span>المتجر العام للزبائن</span>
        </Link>
        <button
          type="button"
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 transition text-right cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج الآمن</span>
        </button>
      </div>
    </aside>
  );
}
