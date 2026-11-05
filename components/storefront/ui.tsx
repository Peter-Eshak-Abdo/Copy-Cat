"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useInView } from "motion/react";
import { Sparkles } from "lucide-react";
import { openWhatsAppChat } from "@/lib/utils";
import { SITE_CONFIG } from "@/lib/site-config";

/** Small pieces shared by the storefront pages (home, products) */

export const WHATSAPP_NUMBER = SITE_CONFIG.store.phone;
export const WHATSAPP_INTERNATIONAL = SITE_CONFIG.store.phoneIntl;
export const FACEBOOK_PAGE_URL = SITE_CONFIG.store.facebookUrl;
export const SERVICES_CATEGORY = "خدمات وطباعة";

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* WhatsApp link: a stable href (same on server and client) and a click handler that opens the app on
   phones / WhatsApp Web on PCs. */
export function waHref(text?: string) {
  return `https://wa.me/${WHATSAPP_INTERNATIONAL}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function WaLink({
  text,
  className,
  children,
  title,
}: {
  text?: string;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <a
      href={waHref(text)}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      onClick={(e) => {
        if (openWhatsAppChat(WHATSAPP_INTERNATIONAL, text)) e.preventDefault();
      }}
      className={className}
    >
      {children}
    </a>
  );
}

export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to]);
  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString("ar-EG")}
      {suffix}
    </span>
  );
}

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: ReactNode; subtitle?: string }) {
  return (
    <Reveal className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold">
        <Sparkles className="w-3.5 h-3.5" />
        {eyebrow}
      </span>
      <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">{title}</h2>
      {subtitle && <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">{subtitle}</p>}
    </Reveal>
  );
}

export function OpenBadge({ open }: { open: boolean }) {
  return open ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      مفتوح
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
      مغلق الآن
    </span>
  );
}

/** Marks the parts of `text` that match the search words (already normalized) */
export function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>;
  // Match on a normalized copy but cut the original string (same length: normalization maps 1 char -> 1 char
  // except removed tashkeel, so fall back to plain text when the lengths differ)
  const norm = normalizeForHighlight(text);
  if (norm.length !== text.length) return <>{text}</>;
  const marks = new Array<boolean>(text.length).fill(false);
  for (const t of tokens) {
    let from = 0;
    for (;;) {
      const i = norm.indexOf(t, from);
      if (i < 0) break;
      for (let k = i; k < i + t.length; k++) marks[k] = true;
      from = i + t.length;
    }
  }
  const out: ReactNode[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marks[i] !== marks[start]) {
      const piece = text.slice(start, i);
      out.push(
        marks[start] ? (
          <mark key={start} className="bg-amber-200/70 text-inherit rounded-sm px-0.5">
            {piece}
          </mark>
        ) : (
          piece
        )
      );
      start = i;
    }
  }
  return <>{out}</>;
}

function normalizeForHighlight(input: string) {
  return input
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/×/g, "x");
}
