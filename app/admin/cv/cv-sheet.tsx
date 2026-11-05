"use client";

import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  CV_COLORS,
  PAGE_PT,
  SIDEBAR_PT,
  cvMetrics,
  fitScale,
  localizeDigits,
  type AtsMetrics,
  type ClassicMetrics,
  type CvData,
  type CvLang,
  type CvPair,
  type CvTemplate,
} from "@/lib/cv";
import type { CvPhoto } from "@/lib/docx/cv-docx";

/**
 * The CV as a real A4 page (sizes in points, the same numbers the Word builder uses, after the same
 * one-page fit). Inline styles only, so its HTML can be printed on its own: that is the PDF.
 */

const LINE = 1.22;
const pt = (v: number) => `${v.toFixed(2)}pt`;

export const CvSheet = forwardRef<HTMLDivElement, { cv: CvData; lang: CvLang; template: CvTemplate; photo: CvPhoto | null }>(
  function CvSheet({ cv: raw, lang, template, photo }, ref) {
    const cv = localizeDigits(raw, lang);
    const rtl = lang === "ar";
    const usePhoto = template === "classic" ? photo : null;
    const scale = fitScale(cv, lang, template, Boolean(usePhoto));
    const font = rtl ? "'Times New Roman', serif" : "Calibri, Carlito, 'Segoe UI', sans-serif";
    const pair = (p: CvPair) => (p.label ? `${p.label}${rtl ? " : " : ": "}${p.value}` : p.value);
    const page: CSSProperties = {
      width: pt(PAGE_PT.w),
      height: pt(PAGE_PT.h),
      background: "#fff",
      color: "#111",
      fontFamily: font,
      direction: rtl ? "rtl" : "ltr",
      textAlign: rtl ? "right" : "left",
      overflow: "hidden",
      boxSizing: "border-box",
      position: "relative",
    };
    const bulletRow = (key: number | string, bullet: string, text: string, size: number, line: number, after: number, bold = true, indent = 0) => (
      <div key={key} style={{ display: "flex", gap: pt(size * 0.45), fontSize: pt(size), lineHeight: LINE * line, marginBottom: pt(after), fontWeight: bold ? 700 : 400, paddingInlineStart: pt(indent) }}>
        <span style={{ flexShrink: 0 }}>{bullet}</span>
        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{text}</span>
      </div>
    );

    if (template === "ats") {
      const m = cvMetrics("ats", lang, scale) as AtsMetrics;
      const contactRe = /phone|mobile|tel|email|e-mail|address|linkedin|تليفون|التليفون|موبايل|هاتف|بريد|ايميل|إيميل|عنوان|العنوان/i;
      const contact = cv.personal.filter((p) => contactRe.test(p.label));
      const other = cv.personal.filter((p) => !contactRe.test(p.label));
      const H = (children: ReactNode) => (
        <div style={{ fontSize: pt(m.heading), fontWeight: 700, lineHeight: LINE, marginTop: pt(m.headingBefore), marginBottom: pt(m.headingAfter), borderBottom: "1pt solid #000", paddingBottom: "2pt" }}>
          {children}
        </div>
      );
      const up = (s: string) => (rtl ? s : s.toUpperCase());
      const list = (items: string[]) => items.map((t, i) => bulletRow(i, "•", t, m.body, m.bodyLine, m.itemAfter, false));
      return (
        <div ref={ref} data-cv-sheet="" style={{ ...page, padding: pt(m.margin), color: "#000" }}>
          <div style={{ textAlign: "center", fontSize: pt(m.name), fontWeight: 700, lineHeight: LINE, marginBottom: pt(m.nameAfter) }}>{cv.name || (rtl ? "الاسم" : "Name")}</div>
          {cv.jobTitle && <div style={{ textAlign: "center", fontSize: pt(m.job), lineHeight: LINE, marginBottom: pt(m.nameAfter) }}>{cv.jobTitle}</div>}
          {contact.length > 0 && (
            <div style={{ textAlign: "center", fontSize: pt(m.contact), lineHeight: LINE, marginBottom: pt(m.contactAfter) }}>{contact.map((p) => p.value).join("  |  ")}</div>
          )}
          {cv.objective && (
            <>
              {H(up(cv.headings.objective))}
              <div style={{ fontSize: pt(m.body), lineHeight: LINE * m.bodyLine, marginBottom: pt(m.itemAfter) }}>{cv.objective}</div>
            </>
          )}
          {cv.education.length > 0 && (
            <>
              {H(up(cv.headings.education))}
              {cv.education.map((e, i) => (
                <div key={i}>
                  {e.title && <div style={{ fontSize: pt(m.eduTitle), fontWeight: 700, lineHeight: LINE * m.bodyLine, marginBottom: pt(m.itemAfter) }}>{e.title}</div>}
                  {list(e.details)}
                </div>
              ))}
            </>
          )}
          {(
            [
              [cv.headings.experience, cv.experience],
              [cv.headings.courses, cv.courses],
              [cv.headings.skills, cv.skills],
              [cv.headings.languages, cv.languages.map(pair)],
              ...cv.extra.map((x) => [x.heading, x.items] as [string, string[]]),
              [cv.headings.personal, other.map(pair)],
            ] as [string, string[]][]
          )
            .filter(([, items]) => items.length > 0)
            .map(([h, items], i) => (
              <div key={i}>
                {H(up(h))}
                {list(items)}
              </div>
            ))}
        </div>
      );
    }

    const m = cvMetrics("classic", lang, scale) as ClassicMetrics;
    const sideBlock = (title: string, items: string[], bullet: string) =>
      items.length > 0 && (
        <div style={{ marginBottom: pt(m.sideBlockAfter) }}>
          <div style={{ width: "165pt", margin: `0 auto ${pt(m.pillAfter)}`, background: `#${CV_COLORS.pill}`, color: "#fff", textAlign: "center", fontWeight: 700, fontSize: pt(m.pill), lineHeight: LINE, padding: `${pt(m.pillPad)} 9pt` }}>
            {title}
          </div>
          {items.map((t, i) => bulletRow(i, bullet, t, m.sideItem, m.sideLine, m.sideAfter))}
        </div>
      );
    const bar = (title: string, icon: string) => (
      <div style={{ width: "235pt", background: `#${CV_COLORS.heading}`, color: "#fff", fontWeight: 700, fontSize: pt(m.bar), lineHeight: LINE, padding: `${pt(m.barPad)} 9pt`, marginBottom: pt(m.barAfter) }}>
        {icon}&nbsp;&nbsp;{title}
      </div>
    );
    const section = (key: string, title: string, icon: string, body: ReactNode) => (
      <div key={key} style={{ marginBottom: pt(m.sectionAfter) }}>
        {bar(title, icon)}
        {body}
      </div>
    );
    const list = (items: string[], bullet: string, size: number) => items.map((t, i) => bulletRow(i, bullet, t, size, m.listLine, m.itemAfter));
    const languages = sideBlock(cv.headings.languages, cv.languages.map(pair), "▪");
    const skills = sideBlock(cv.headings.skills, cv.skills, "•");

    return (
      <div ref={ref} data-cv-sheet="" style={{ ...page, display: "flex" }}>
        <div style={{ width: pt(SIDEBAR_PT), flexShrink: 0, background: `#${CV_COLORS.sidebar}`, color: "#fff", padding: `${pt(m.sideTop)} 13pt 0`, boxSizing: "border-box" }}>
          {usePhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={usePhoto.dataUrl} alt="" style={{ display: "block", margin: `0 auto ${pt(12 * scale)}`, height: pt(m.photo), width: pt(m.photo * usePhoto.aspect), objectFit: "cover" }} />
          )}
          {sideBlock(cv.headings.personal, cv.personal.map(pair), "✓")}
          {rtl ? (
            <>
              {languages}
              {skills}
            </>
          ) : (
            <>
              {skills}
              {languages}
            </>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: `${pt(m.mainTop)} 19pt 0`, boxSizing: "border-box" }}>
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: pt(m.name), lineHeight: LINE, color: `#${rtl ? CV_COLORS.nameAr : CV_COLORS.nameEn}`, marginBottom: pt(cv.jobTitle ? 2 : m.nameAfter) }}>
            {cv.name || <span style={{ opacity: 0.3 }}>{rtl ? "الاسم" : "Name"}</span>}
          </div>
          {cv.jobTitle && <div style={{ textAlign: "center", fontWeight: 700, color: "#475569", fontSize: pt(m.job), lineHeight: LINE, marginBottom: pt(m.nameAfter) }}>{cv.jobTitle}</div>}
          {cv.objective &&
            section(
              "o",
              cv.headings.objective,
              "🎯",
              <div style={{ fontWeight: 700, fontSize: pt(m.objective), lineHeight: LINE * m.objectiveLine, textAlign: "justify" }}>{cv.objective}</div>
            )}
          {cv.education.length > 0 &&
            section(
              "e",
              cv.headings.education,
              "🎓",
              cv.education.map((e, i) => (
                <div key={i}>
                  {e.title && <div style={{ fontWeight: 700, fontSize: pt(m.eduTitle), lineHeight: LINE, marginBottom: pt(m.itemAfter) }}>❖ {e.title}</div>}
                  {e.details.map((d, k) => bulletRow(k, "•", d, m.eduDetail, m.listLine, m.itemAfter, true, 12))}
                </div>
              ))
            )}
          {cv.experience.length > 0 && section("x", cv.headings.experience, "💼", list(cv.experience, rtl ? "✓" : "•", m.experience))}
          {cv.courses.length > 0 && section("c", cv.headings.courses, "📜", list(cv.courses, "•", m.other))}
          {cv.extra.map((x, i) => x.items.length > 0 && section(`x${i}`, x.heading, "⭐", list(x.items, "•", m.other)))}
        </div>
      </div>
    );
  }
);

/** The A4 sheet shrunk to the width of its box */
export function ScaledSheet({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0.6);
  const pagePx = (PAGE_PT.w / 72) * 96;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setK(Math.min(1, el.clientWidth / pagePx)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pagePx]);
  return (
    <div ref={boxRef} className="w-full">
      <div style={{ width: pagePx * k, height: ((PAGE_PT.h / 72) * 96) * k, margin: "0 auto" }} className="shadow-lg overflow-hidden">
        <div style={{ transform: `scale(${k})`, transformOrigin: "top left", width: pagePx }}>{children}</div>
      </div>
    </div>
  );
}

/**
 * The PDF copy: the sheet printed on its own A4 page. The browser's print window opens; "Save as PDF" there
 * keeps real text (Arabic shaped correctly), which a picture of the page would not.
 */
export function printSheet(sheet: HTMLElement, title: string) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "")}</title>` +
      `<style>@page{size:A4;margin:0}html,body{margin:0;padding:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>` +
      `</head><body>${sheet.outerHTML}</body></html>`
  );
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };
  // Pictures (the photo) must be loaded before printing
  const imgs = Array.from(doc.images);
  Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))).then(() => window.setTimeout(go, 50));
}
