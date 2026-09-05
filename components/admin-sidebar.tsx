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
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "لوحة التحكم", href: "/admin", icon: LayoutDashboard },
  { name: "مصنع البطاقات والمستندات (A5)", href: "/admin/id-cards", icon: CreditCard },
  { name: "استوديو الصور الشخصية (4x6)", href: "/admin/passport-photos", icon: Camera },
  { name: "ماسح المستندات وتوفير الحبر", href: "/admin/scanner", icon: ScanLine },
  { name: "مولد الأبحاث الذكي", href: "/admin/research", icon: FileText },
  { name: "المخزن والـ POS (حصر)", href: "/admin/inventory", icon: Boxes },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 border-l border-slate-800 flex flex-col justify-between p-4 min-h-screen">
      <div>
        <div className="flex items-center gap-3 px-2 py-4 mb-6 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-extrabold shadow-lg shadow-blue-500/20">
            PS
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">أوفيس برنت ستوديو</h1>
            <p className="text-xs text-blue-400 font-medium">لوحة إدارة الموظفين</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-400")} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-800 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
        >
          <Home className="w-5 h-5" />
          <span>المتجر العام للزبائن</span>
        </Link>
        <Link
          href="/login"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/30 transition"
        >
          <LogOut className="w-5 h-5" />
          <span>تسجيل الخروج</span>
        </Link>
      </div>
    </aside>
  );
}
