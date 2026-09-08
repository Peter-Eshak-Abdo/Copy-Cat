"use client";

import Link from "next/link";
import Image from "next/image";
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
  Calculator,
  CheckSquare,
  Globe,
  Share2,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-provider";

interface NavGroup {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const navGroups: NavGroup[] = [
  {
    title: "الرئيسية والمخزن",
    items: [
      { name: "لوحة التحكم الرئيسية", href: "/admin", icon: LayoutDashboard },
      { name: "إدارة المخزن والكتالوج (حصر)", href: "/admin/inventory", icon: Boxes },
    ],
  },
  {
    title: "أدوات المطبعة والتصوير",
    items: [
      { name: "حاسبة المطبعة والملازم", href: "/admin/calculator", icon: Calculator },
      { name: "مهام وأوردرات الشيفت", href: "/admin/tasks", icon: CheckSquare },
      { name: "مصنع البطاقات والمستندات (A5)", href: "/admin/id-cards", icon: CreditCard },
      { name: "استوديو الصور الشخصية (4x6)", href: "/admin/passport-photos", icon: Camera },
      { name: "ماسح المستندات وتوفير الحبر", href: "/admin/scanner", icon: ScanLine },
    ],
  },
  {
    title: "المستندات والذكاء الاصطناعي",
    items: [
      { name: "استوديو وأدوات الـ PDF", href: "/admin/pdf-tools", icon: FileText },
      { name: "الماسح الضوئي الذكي (OCR)", href: "/admin/ocr", icon: Sparkles },
      { name: "شيتات المفردات المدرسية", href: "/admin/school-sheets", icon: GraduationCap },
      { name: "مولد الأبحاث الأكاديمية", href: "/admin/research", icon: FileText },
    ],
  },
  {
    title: "الشبكة والإنتاجية",
    items: [
      { name: "مواقع وسيرفرات يومية", href: "/admin/shortcuts", icon: Globe },
      { name: "نقل سريع بالشبكة (LAN)", href: "/admin/lan-transfer", icon: Share2 },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-white dark:bg-slate-900/95 border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 min-h-screen shrink-0 transition-colors duration-300">
      <div className="space-y-4">
        {/* Branding */}
        <div className="flex items-center justify-between px-2 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex items-center justify-center p-0.5 border border-slate-300 dark:border-slate-700/50 shadow-md shrink-0">
              <Image
                src="/logo.jpg"
                alt="Copy Cat"
                width={40}
                height={40}
                priority
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 dark:text-white text-base leading-tight">كوبي كات</h1>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Copy-Cat ERP</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* User Info pill */}
        {user && (
          <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="truncate">
              <span className="text-slate-800 dark:text-slate-200 font-bold block truncate">{user.name}</span>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block truncate">{user.email}</span>
            </div>
          </div>
        )}

        {/* Grouped Navigation */}
        <nav className="space-y-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {group.title}
              </div>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200",
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-slate-500 dark:text-slate-400")} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Actions */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
        >
          <Home className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>المتجر العام للزبائن</span>
        </Link>
        <button
          type="button"
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 transition text-right cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج الآمن</span>
        </button>
      </div>
    </aside>
  );
}
