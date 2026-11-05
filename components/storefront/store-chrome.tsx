"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Clock, ExternalLink, MapPin, MessageCircle, Search, ShoppingBag } from "lucide-react";
import { SITE_CONFIG } from "@/lib/site-config";
import { ALL_CATEGORY } from "@/components/storefront/storefront-utils";
import { useStore } from "@/components/storefront/store-provider";
import { FACEBOOK_PAGE_URL, OpenBadge, WHATSAPP_NUMBER, WaLink } from "@/components/storefront/ui";

const NAV: [string, string][] = [
  ["/#services", "خدماتنا"],
  ["/products", "المنتجات"],
  ["/#categories", "الأقسام"],
  ["/faq", "أسئلة شائعة"],
  ["/#contact", "تواصل معنا"],
];

export function StoreHeader() {
  const { isStoreOpen, totalCartCount, cartBump, openCart, cartButtonRef, announcementText } = useStore();
  const pathname = usePathname();
  return (
    <>
      {/* Announcement marquee */}
      <div className="bg-gradient-to-l from-blue-700 via-blue-600 to-indigo-600 text-white text-xs font-semibold py-2 overflow-hidden">
        <div className="cc-marquee flex w-max gap-10 whitespace-nowrap">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-10" aria-hidden={dup === 1}>
              <span>⚡ {announcementText}</span>
              <span>📲 ابعت ملفاتك على الواتساب {WHATSAPP_NUMBER} واستلمها جاهزة</span>
              <span>🕘 {SITE_CONFIG.store.hoursDisplay}</span>
              <span>📍 شارع الدقهلية - عرايشية مصر - الإسماعيلية</span>
            </div>
          ))}
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 h-16 px-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <motion.div whileHover={{ rotate: -8, scale: 1.06 }} className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-slate-200 p-1 shadow-sm">
              <Image src="/logo.jpg" alt="Copy Cat" width={40} height={40} priority className="w-full h-full object-contain" />
            </motion.div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg text-slate-900 tracking-tight">كوبي كات</span>
                <OpenBadge open={isStoreOpen} />
              </div>
              <span className="text-[11px] text-slate-500 hidden sm:block">مكتبة ومطبعة • الإسماعيلية</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 text-sm font-bold text-slate-600">
            {NAV.map(([href, label]) => {
              const active = !href.includes("#") && pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3 py-2 rounded-lg transition ${active ? "text-blue-700" : "hover:bg-slate-100 hover:text-blue-700"}`}
                >
                  {label}
                  {active && <motion.span layoutId="nav-underline" className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-blue-600" />}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/products?focus=1"
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:border-blue-400 hover:text-blue-700 transition"
              aria-label="ابحث عن منتج"
              title="ابحث عن منتج"
            >
              <Search className="w-4 h-4" />
            </Link>
            <WaLink className="flex items-center gap-1.5 px-2.5 sm:px-3 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm shadow-emerald-600/30">
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">واتساب {WHATSAPP_NUMBER}</span>
              <span className="hidden sm:inline md:hidden">واتساب</span>
            </WaLink>
            <motion.button
              ref={cartButtonRef}
              key={cartBump}
              animate={cartBump ? { scale: [1, 1.25, 0.92, 1] } : undefined}
              transition={{ duration: 0.45 }}
              onClick={openCart}
              className="relative flex items-center gap-1.5 px-2.5 sm:px-3 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
              aria-label="السلة"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">السلة</span>
              {totalCartCount > 0 && (
                <span className="absolute -top-1.5 -left-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center ring-2 ring-white">
                  {totalCartCount}
                </span>
              )}
            </motion.button>
          </div>
        </div>
      </header>
    </>
  );
}

export function StoreFooter() {
  const { categories } = useStore();
  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-24 sm:pb-10 px-4">
      <div className="max-w-7xl mx-auto grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white p-1">
              <Image src="/logo.jpg" alt="Copy Cat" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <span className="font-black text-lg text-white">كوبي كات Copy Cat</span>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">مطبعة ديجيتال ومكتبة أدوات مكتبية ومدرسية في الإسماعيلية.</p>
        </div>
        <div>
          <h4 className="text-white font-black text-sm mb-3">روابط سريعة</h4>
          <ul className="space-y-2 text-sm">
            {[
              ["/#services", "الخدمات"],
              ["/products", "كل المنتجات"],
              ["/#how", "إزاي تطلب"],
              ["/faq", "أسئلة شائعة"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="hover:text-white transition">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-white font-black text-sm mb-3">الأقسام</h4>
          <ul className="space-y-2 text-sm">
            {categories
              .filter((c) => c !== ALL_CATEGORY)
              .slice(0, 5)
              .map((c) => (
                <li key={c}>
                  <Link href={`/products?cat=${encodeURIComponent(c)}`} className="hover:text-white transition">
                    {c}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
        <div className="space-y-2.5 text-sm">
          <h4 className="text-white font-black text-sm mb-3">تواصل معنا</h4>
          <WaLink className="flex items-center gap-2 hover:text-emerald-400 transition">
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span dir="ltr">{WHATSAPP_NUMBER}</span>
          </WaLink>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>{SITE_CONFIG.store.hoursDisplay}</span>
          </div>
          <a href={SITE_CONFIG.store.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 hover:text-white transition">
            <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>عرايشية مصر، الإسماعيلية</span>
          </a>
          <a href={FACEBOOK_PAGE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition">
            <ExternalLink className="w-4 h-4 text-blue-400" />
            <span>صفحتنا على فيسبوك</span>
          </a>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-white/10 text-xs text-slate-500 text-center">
        مكتبة كوبي كات Copy Cat • جميع الحقوق محفوظة © {new Date().getFullYear()}
      </div>
    </footer>
  );
}
