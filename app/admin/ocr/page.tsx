"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { useToast } from "@/components/toast-provider";
import { readFileAsDataURL } from "@/lib/utils";
import { generateOcrDocx, PageBorderKind, FIGURE_LINE, type OcrFigure } from "@/lib/docx/ocr-docx";
import { splitMath } from "@/lib/docx/latex-math";
import { cropFigures, imageAspect, prepareOcrImage, tesseractOcr, uprightPage } from "@/lib/ocr-client";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  Layers,
  ImagePlus,
  ArrowUp,
  ArrowDown,
  Trash2,
  UploadCloud,
  Eye,
  ZoomIn,
  ZoomOut,
  Loader2,
  Sparkles,
  FileText,
  Copy,
  Download,
} from "lucide-react";


/** Text with $...$ maths rendered by KaTeX (fractions, powers, roots) */
function withMath(text: string): React.ReactNode {
  const parts = splitMath(text);
  if (parts.length === 1 && !parts[0].math) return text;
  return parts.map((part, k) =>
    part.math ? (
      <span
        key={k}
        dir="ltr"
        className="inline-block mx-0.5"
        // KaTeX output is generated markup (trust is off), not user HTML
        dangerouslySetInnerHTML={{ __html: katex.renderToString(part.s, { throwOnError: false, strict: "ignore" }) }}
      />
    ) : (
      <React.Fragment key={k}>{part.s}</React.Fragment>
    )
  );
}

// Strips inline markup for the on-screen preview; " || " items are laid out like the Word export:
// two parts = trailing label at the far edge, three or more = equal columns (multiple-choice options)
function previewLine(text: string): React.ReactNode {
  const clean = text
    .replace(/<\/?u>/gi, "")
    .replace(/<\/?center>/gi, "")
    .replace(/\*\*/g, "")
    .replace(/\s*\{\s*\d+(?:\.\d+)?\s*\}\s*$/, "");
  const parts = clean.split(/\s*\|\|\s*/).filter((p) => p.trim());
  if (parts.length < 2) return withMath(clean);
  if (parts.length >= 3) {
    return (
      <span className="grid gap-2" style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))` }}>
        {parts.map((p, k) => (
          <span key={k}>{withMath(p)}</span>
        ))}
      </span>
    );
  }
  return (
    <span className="flex justify-between gap-4">
      <span>{withMath(parts[0])}</span>
      <span className="shrink-0">{withMath(parts[1])}</span>
    </span>
  );
}

interface OcrPageItem {
  id: string;
  file: File;
  dataUrl: string;
  name: string;
  status: "pending" | "processing" | "done" | "error";
  extractedText?: string;
}

export default function MultiStageOcrPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pages, setPages] = useState<OcrPageItem[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomPreview, setZoomPreview] = useState(false);

  const [refinedText, setRefinedText] = useState<string>("");
  const [docTitle, setDocTitle] = useState<string>("مستند_كوبي_كات.docx");
  const [viewMode, setViewMode] = useState<"visual" | "raw">("visual");

  // Requirement #4: Font detection, Arial fallback, and Language / Direction Settings
  const [selectedFont, setSelectedFont] = useState<string>("Arial");
  const [fontManuallyChanged, setFontManuallyChanged] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
  // Page frame and body weight are detected from the scan, and can be overridden before export
  const [borderStyle, setBorderStyle] = useState<PageBorderKind>("none");
  const [boldBody, setBoldBody] = useState<boolean>(false);
  // Figures cropped from the scans, keyed by the number in their "[شكل n]" line
  const [figures, setFigures] = useState<Record<number, OcrFigure>>({});
  // Second pass: the same model re-reads the page image against its own draft
  const [verifyPass, setVerifyPass] = useState<boolean>(true);
  // Wide forms and tables (usually scanned sideways) are exported on a landscape page
  const [landscape, setLandscape] = useState<boolean>(false);
  // Progress of the running extraction, for the loading panel and its time estimate
  const [run, setRun] = useState<{
    total: number;
    done: number;
    stage: string;
    startedAt: number;
    pageStartedAt: number;
    msPerPage: number;
  } | null>(null);
  // Clock for the estimate, ticking only while a run is in progress
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!run) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [run]);

  const activePage = pages[activePageIndex] || null;

  // Render extracted markdown text preserving tables, headings, and alignments visually
  // Render extracted markdown text preserving tables, headings, and alignments visually (Requirement #4)
  const renderVisualDocument = (text: string) => {
    if (!text.trim()) {
      return (
        <div className="py-20 text-center text-slate-400 text-xs sm:text-sm">
          النص اللي هيتقرا من الصور هيظهر هنا بالجداول والعناوين زي الأصل...
        </div>
      );
    }

    const isDocAr =
      selectedLanguage === "ar"
        ? true
        : selectedLanguage === "en" || selectedLanguage === "fr"
        ? false
        : /[\u0600-\u06FF]/.test(text);

    const lines = text.split(/\r?\n/);
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const rawLine = lines[i].trim();
      if (!rawLine) {
        i++;
        continue;
      }
      const centered = /<center>/i.test(rawLine);
      const line = rawLine.replace(/<\/?center>/gi, "").trim();

      const figMatch = line.match(FIGURE_LINE);
      if (figMatch) {
        const fig = figures[Number(figMatch[1])];
        elements.push(
          fig ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL cropped in the browser
            <img key={`fig-${i}`} src={fig.dataUrl} alt={line} className="mx-auto my-2 max-h-72 border border-slate-200 rounded" />
          ) : (
            <div key={`fig-${i}`} className="my-2 text-center text-xs text-slate-400">{line}</div>
          )
        );
        i++;
        continue;
      }

      // 1. Markdown Table
      if (line.startsWith("|") && line.endsWith("|")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
          tableLines.push(lines[i].trim());
          i++;
        }

        const validRows = tableLines.filter((l) => {
          const clean = l.replace(/\|/g, "").replace(/[-:\s]/g, "");
          return clean.length > 0;
        });

        if (validRows.length > 0) {
          const tableIsAr = /[\u0600-\u06FF]/.test(validRows.join(" ")) || isDocAr;
          const headerCells = validRows[0]
            .split("|")
            .map((c) => c.trim())
            .slice(1, -1);
          const dataRows = validRows.slice(1).map((r) =>
            r
              .split("|")
              .map((c) => c.trim())
              .slice(1, -1)
          );

          elements.push(
            <div key={`table-${i}`} dir={tableIsAr ? "rtl" : "ltr"} className="my-4 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className={`w-full text-xs border-collapse ${tableIsAr ? "text-right" : "text-left"}`}>
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    {headerCells.map((cell, cIdx) => (
                      <th
                        key={cIdx}
                        className={`p-2.5 sm:p-3 font-black text-slate-900 border-l border-slate-200 last:border-l-0 ${tableIsAr ? "text-right" : "text-left"}`}
                      >
                        {previewLine(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/70 transition">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`p-2.5 text-slate-800 border-l border-slate-200 last:border-l-0 leading-relaxed font-sans ${tableIsAr ? "text-right" : "text-left"}`}
                        >
                          {previewLine(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      const lineIsAr = /[\u0600-\u06FF]/.test(line) || (isDocAr && !/^[A-Za-z0-9\s.,'?!:;()\-*]+$/.test(line));

      // 2. Heading Level 1
      if (line.startsWith("# ")) {
        elements.push(
          <h2 key={`h1-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className="text-lg font-black text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200 text-center">
            {previewLine(line.replace(/^#\s+/, ""))}
          </h2>
        );
        i++;
        continue;
      }

      // 3. Heading Level 2
      if (line.startsWith("## ")) {
        elements.push(
          <h3 key={`h2-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className="text-base font-bold text-slate-800 mt-3 mb-1.5 text-center">
            {previewLine(line.replace(/^##\s+/, ""))}
          </h3>
        );
        i++;
        continue;
      }

      // 4. Heading Level 3
      if (line.startsWith("### ")) {
        elements.push(
          <h4 key={`h3-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className={`text-sm font-bold text-slate-700 mt-2 mb-1 ${lineIsAr ? "text-right" : "text-left"}`}>
            {previewLine(line.replace(/^###\s+/, ""))}
          </h4>
        );
        i++;
        continue;
      }

      // 5. Short heading with colon
      if (line.length < 60 && (line.endsWith(":") || line.endsWith(":-")) && !line.includes(".")) {
        elements.push(
          <h5 key={`h4-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className={`text-xs sm:text-sm font-black text-slate-900 mt-3 mb-1 ${lineIsAr ? "text-right" : "text-left"}`}>
            {previewLine(line)}
          </h5>
        );
        i++;
        continue;
      }

      // 6. Bullet lists
      if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ")) {
        elements.push(
          <div key={`li-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className={`flex items-start gap-2 ${lineIsAr ? "mr-2 text-right" : "ml-2 text-left"} text-xs sm:text-sm text-slate-800 my-1`}>
            <span className="text-blue-600 font-bold">•</span>
            <span>{previewLine(line.replace(/^[-*•]\s+/, ""))}</span>
          </div>
        );
        i++;
        continue;
      }

      // 7. Regular paragraph (Requirement #4: Right align for Arabic, Left align for English/French)
      elements.push(
        <p key={`p-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className={`text-xs sm:text-sm text-slate-800 leading-relaxed my-1.5 whitespace-pre-wrap ${centered ? "text-center" : lineIsAr ? "text-right" : "text-left"}`}>
          {previewLine(line)}
        </p>
      );
      i++;
    }

    return <div className="space-y-1">{elements}</div>;
  };

  // Dynamic Word & Char counters
  const { wordCount, charCount } = useMemo(() => {
    const text = refinedText.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;
    return { wordCount: words, charCount: chars };
  }, [refinedText]);

  // Add files to pages list
  const addFilesToPages = async (fileList: File[]) => {
    const newItems: OcrPageItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        const dataUrl = await readFileAsDataURL(file);
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          dataUrl,
          name: file.name,
          status: "pending",
        });
      } catch {
        // skip corrupted file
      }
    }

    if (newItems.length === 0) {
      toast.warning("الملف ده مش صورة", "اختار صور بس (JPG أو PNG أو WEBP)");
      return;
    }

    setPages((prev) => {
      const updated = [...prev, ...newItems];
      if (prev.length === 0 && updated.length > 0) {
        const cleanName = updated[0].file.name.replace(/\.[^/.]+$/, "");
        setDocTitle(`مستند_${cleanName}.docx`);
      }
      return updated;
    });

    toast.success(
      "الصفحات اتضافت",
      `ضفنا ${newItems.length} صورة. رتبهم بالأسهم لو محتاج، وبعدين دوس «ابدأ القراية».`
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await addFilesToPages(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await addFilesToPages(Array.from(e.dataTransfer.files));
    }
  };

  // Re-ordering pages
  const movePageUp = (index: number) => {
    if (index <= 0) return;
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
    if (activePageIndex === index) {
      setActivePageIndex(index - 1);
    } else if (activePageIndex === index - 1) {
      setActivePageIndex(index);
    }
  };

  const movePageDown = (index: number) => {
    if (index >= pages.length - 1) return;
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
    if (activePageIndex === index) {
      setActivePageIndex(index + 1);
    } else if (activePageIndex === index + 1) {
      setActivePageIndex(index);
    }
  };

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
    if (activePageIndex >= pages.length - 1 && activePageIndex > 0) {
      setActivePageIndex(activePageIndex - 1);
    }
  };

  // Multi-page sequential extraction: extract -> same-model verification against the image -> figure crops
  const handleProcessOcr = async () => {
    if (pages.length === 0) {
      if (fileInputRef.current) fileInputRef.current.click();
      toast.warning("مفيش صفحات", "ارفع صورة الصفحة الأول");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("النت فاصل", "القراية محتاجة إنترنت");
      return;
    }

    setIsProcessing(true);
    setRefinedText("");
    setFigures({});
    // First guess per page (direction + reading + optional review); replaced by the measured average
    const now = Date.now();
    setRun({ total: pages.length, done: 0, stage: "بنجهز الصفحة", startedAt: now, pageStartedAt: now, msPerPage: verifyPass ? 45_000 : 25_000 });
    const stage = (text: string) => setRun((r) => (r ? { ...r, stage: text } : r));

    let combinedRaw = "";
    const allFigures: Record<number, OcrFigure> = {};
    let figureCount = 0;

    const callOcr = async (body: object) => {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    };

    try {
      for (let i = 0; i < pages.length; i++) {
        setActivePageIndex(i);
        setPages((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: "processing" } : p)));
        setRun((r) => (r ? { ...r, pageStartedAt: Date.now() } : r));
        stage("بنشوف الصفحة متلفّة ولا لأ");

        // Sideways or upside-down scans are turned upright first
        const upright = await uprightPage(pages[i].dataUrl);
        if (upright.rotation) {
          setPages((prev) => prev.map((p, idx) => (idx === i ? { ...p, dataUrl: upright.dataUrl } : p)));
          toast.info("الصفحة كانت متلفّة", `عدلنا الصفحة ${i + 1} قبل القراية.`);
        }
        if (i === 0) setLandscape((await imageAspect(upright.dataUrl)) > 1.15);
        const image = await prepareOcrImage(upright.dataUrl);
        stage("بنقرا الكلام");
        let pageText = "";
        const extract = await callOcr({ action: "extract", imageBase64: image }).catch(() => ({ ok: false, data: {} }));

        if (extract.ok && extract.data.extractedText) {
          const data = extract.data;
          pageText = data.extractedText;

          if (data.detectedFont && !fontManuallyChanged) setSelectedFont(data.detectedFont);
          if (data.detectedLang && selectedLanguage === "auto") setSelectedLanguage(data.detectedLang);
          if (i === 0) {
            if (["none", "single", "double", "decorative"].includes(data.detectedBorder)) {
              setBorderStyle(data.detectedBorder);
            }
            // Framed legal forms are printed bold almost without exception
            setBoldBody(data.detectedWeight === "bold" || data.detectedBorder === "decorative");
          }
          if (data.lowAccuracy) {
            toast.warning(
              "اتقرت بموديل احتياطي أضعف",
              `Gemini مش متاح دلوقتي، فراجع نص الصفحة ${i + 1} كويس قبل ما تطبع.`
            );
          }

          // 2. Verification: the model that made the draft re-reads the page image against it
          if (verifyPass && !data.lowAccuracy) {
            stage("بنراجع الكلام على الصورة حرف بحرف");
            const verify = await callOcr({ action: "verify", imageBase64: image, draft: pageText, provider: data.provider }).catch(
              () => ({ ok: false, data: {} })
            );
            if (verify.ok && verify.data.verified && verify.data.verifiedText) pageText = verify.data.verifiedText;
          }
        } else {
          // 3. Every server model failed: Tesseract in the browser (plain text only)
          toast.warning("الذكاء الاصطناعي مش متاح دلوقتي", `هنقرا الصفحة ${i + 1} من على الجهاز (نص بس من غير جداول، ودقته أقل)...`);
          stage("بنقرا من على الجهاز (أبطأ)");
          pageText = await tesseractOcr(image);
        }

        // 4. Figures, shapes and drawings are cropped from the scan into the document
        const isAr = /[؀-ۿ]/.test(pageText);
        const cropped = await cropFigures(image, pageText, figureCount + 1, isAr);
        pageText = cropped.text;
        Object.assign(allFigures, cropped.figures);
        figureCount += Object.keys(cropped.figures).length;
        setFigures({ ...allFigures });

        setPages((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: "done", extractedText: pageText } : p)));

        if (pages.length > 1) {
          combinedRaw += `\n\n════════════════════════════════════════\n📄 الصفحة رقم (${i + 1}):\n════════════════════════════════════════\n\n${pageText}`;
        } else {
          combinedRaw += pageText;
        }
        setRefinedText(combinedRaw);
        setRun((r) => {
          if (!r) return r;
          const done = i + 1;
          return { ...r, done, msPerPage: (Date.now() - r.startedAt) / done };
        });
      }

      toast.success("خلصنا", `اتقرت ${pages.length} صفحة وجاهزة تنزلها Word.`);
    } catch (err: unknown) {
      setPages((prev) => prev.map((p) => (p.status === "processing" ? { ...p, status: "error" } : p)));
      const msg = err instanceof Error ? err.message : "حصلت مشكلة وإحنا بنقرا الصفحات";
      toast.error("القراية وقفت", msg);
    } finally {
      setIsProcessing(false);
      setRun(null);
    }
  };

  // Seconds left: pages still to read at the measured pace, minus what the current page has used already
  const secondsLeft = run
    ? Math.max(5, Math.round(((run.total - run.done) * run.msPerPage - Math.max(0, now - run.pageStartedAt)) / 1000))
    : 0;
  const formatLeft = (s: number) =>
    s < 60 ? `${s} ثانية` : `${Math.floor(s / 60)} دقيقة${s % 60 >= 10 ? ` و${s % 60} ثانية` : ""}`;

  // Action: Export Word .docx (Requirement #4)
  const handleExportWord = async () => {
    if (!refinedText.trim()) {
      toast.warning("مفيش نص", "اقرا الصفحات الأول وبعدين نزّل ملف Word");
      return;
    }

    try {
      await generateOcrDocx({
        content: refinedText,
        fileName: docTitle.endsWith(".docx") ? docTitle : `${docTitle}.docx`,
        font: selectedFont || "Arial",
        borderStyle,
        boldBody,
        language: selectedLanguage as "ar" | "en" | "fr" | "auto",
        figures,
        landscape,
      });
      toast.success("ملف Word نزل", `بخط ${selectedFont || "Arial"}`);
    } catch {
      toast.error("ملف Word منزلش", "حصلت مشكلة. ممكن تنسخ النص وتلزقه في Word بإيدك.");
    }
  };

  // Action: Copy Text to Clipboard
  const handleCopyText = async () => {
    if (!refinedText.trim()) {
      toast.warning("مفيش نص", "اقرا الصفحات الأول");
      return;
    }

    try {
      await navigator.clipboard.writeText(refinedText);
      toast.success("اتنسخ", "النص اتنسخ، الزقه في أي مكان");
    } catch {
      toast.error("منسخش", "حدد النص وانسخه بإيدك");
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col w-full" dir="rtl">
      {/* Hidden File Input (Multiple Supported) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-col gap-space-lg w-full pb-space-3xl pt-space-xs">
        {/* Core Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Left Column: Source Pages & Active Preview */}
          <div className="lg:col-span-5 flex flex-col gap-space-lg">
            {/* Pages Strip & Reordering */}
            <div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg border border-surface-container-high/40">
              <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60 mb-space-sm">
                <div className="flex items-center gap-space-xs">
                  <Layers className="text-primary w-5 h-5" />
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    الصفحات ({pages.length})
                  </span>
                </div>
                <button
                  onClick={handleUploadClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                  type="button"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>+ ضيف صفحات</span>
                </button>
              </div>

              {pages.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                  {pages.map((page, idx) => (
                    <div
                      key={page.id}
                      onClick={() => setActivePageIndex(idx)}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                        activePageIndex === idx
                          ? "bg-primary/10 border-primary shadow-sm"
                          : "bg-surface-container border-surface-container-high hover:border-outline"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={page.dataUrl}
                          alt={page.name}
                          className="w-10 h-10 object-cover rounded-lg border border-surface-container-highest"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-on-surface">
                            صفحة ({idx + 1}): {page.name.slice(0, 22)}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {page.status === "processing"
                              ? "⏳ بنقراها..."
                              : page.status === "done"
                              ? "✅ اتقرت"
                              : page.status === "error"
                              ? "❌ حصلت مشكلة"
                              : "مستنية دورها"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => movePageUp(idx)}
                          className="p-1 rounded hover:bg-surface-bright text-on-surface-variant disabled:opacity-30 cursor-pointer"
                          title="طلّعها فوق"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === pages.length - 1}
                          onClick={() => movePageDown(idx)}
                          className="p-1 rounded hover:bg-surface-bright text-on-surface-variant disabled:opacity-30 cursor-pointer"
                          title="نزّلها تحت"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePage(idx)}
                          className="p-1 rounded hover:bg-error/20 text-error cursor-pointer"
                          title="امسح الصفحة دي"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={handleUploadClick}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="p-6 text-center border-2 border-dashed border-primary/40 rounded-xl cursor-pointer hover:border-primary transition"
                >
                  <UploadCloud className="w-10 h-10 text-primary mx-auto mb-2" />
                  <p className="text-sm font-bold text-on-surface">اسحب صور الصفحات وسيبها هنا</p>
                  <p className="text-xs text-on-surface-variant mt-1">أو دوس هنا واختار صورة أو أكتر من الجهاز. الصفحة المتصورة بالعرض أو بالمقلوب بتتعدل لوحدها.</p>
                </div>
              )}
            </div>

            {/* Active Image Large Preview Card */}
            {activePage && (
              <div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg border border-surface-container-high/40">
                <div className="flex items-center justify-between pb-space-sm">
                  <div className="flex items-center gap-space-xs">
                    <Eye className="w-5 h-5 text-primary" />
                    <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      صفحة {activePageIndex + 1}
                    </span>
                  </div>
                  <button
                    onClick={() => setZoomPreview((prev) => !prev)}
                    className="p-space-2xs rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                    title={zoomPreview ? "صغّر" : "كبّر"}
                    type="button"
                  >
                    {zoomPreview ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative rounded-lg bg-surface-container-lowest overflow-hidden flex items-center justify-center p-space-xs">
                  <div className={`relative w-full overflow-hidden rounded bg-surface-dim flex items-center justify-center ${zoomPreview ? "max-h-[600px]" : "max-h-[380px]"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-auto object-contain max-h-[360px] rounded"
                      src={activePage.dataUrl}
                      alt={activePage.name}
                    />
                  </div>
                </div>
              </div>
            )}

            {run && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2" role="status" aria-live="polite">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                  <p className="text-sm font-bold text-blue-900">
                    صفحة {Math.min(run.done + 1, run.total)} من {run.total}: {run.stage}...
                  </p>
                </div>
                <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-1000"
                    style={{
                      width: `${Math.min(
                        97,
                        Math.max(
                          4,
                          ((run.done + Math.min(0.95, Math.max(0, now - run.pageStartedAt) / run.msPerPage)) / run.total) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-blue-800">
                  فاضل حوالي <strong>{formatLeft(secondsLeft)}</strong>. سيب الصفحة مفتوحة، الشغل شغال.
                </p>
              </div>
            )}

            {/* Action Start Button */}
            <button
              onClick={handleProcessOcr}
              disabled={isProcessing || pages.length === 0}
              className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              <span>
                {isProcessing
                  ? `بنقرا صفحة ${activePageIndex + 1} من ${pages.length}...`
                  : pages.length > 1
                  ? `ابدأ القراية (${pages.length} صفحات)`
                  : "ابدأ القراية"}
              </span>
            </button>
          </div>

          {/* Right Column: Extracted Document & Export */}
          <div className="lg:col-span-7 flex flex-col gap-space-lg">
            <div className="flex flex-col rounded-2xl bg-white p-space-md shadow-sm border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-bold text-slate-900">
                    النص اللي اتقرا
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* View Mode Toggle: Visual Tables vs Raw Textarea */}
                  <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setViewMode("visual")}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        viewMode === "visual"
                          ? "bg-white text-blue-600 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      شكل الورقة
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("raw")}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        viewMode === "raw"
                          ? "bg-white text-blue-600 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      عدّل النص
                    </button>
                  </div>

                  <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-mono">
                    {wordCount} كلمة | {charCount} حرف
                  </span>
                  <button
                    onClick={handleCopyText}
                    className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200"
                  >
                    <Copy className="w-4 h-4" />
                    <span>انسخ</span>
                  </button>
                  <button
                    onClick={handleExportWord}
                    disabled={!refinedText.trim()}
                    className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>نزّل Word</span>
                  </button>
                </div>
              </div>

              {/* Document Configuration Toolbar (Requirement #4) */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl mb-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Font Selector with Arial as default fallback */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700">الخط:</span>
                    <select
                      value={selectedFont}
                      onChange={(e) => {
                        setSelectedFont(e.target.value);
                        setFontManuallyChanged(true);
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                    >
                      <option value="Arial">Arial (العادي)</option>
                      <option value="Simplified Arabic">Simplified Arabic (للعقود)</option>
                      <option value="Traditional Arabic">Traditional Arabic (للورق الحكومي)</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Calibri">Calibri</option>
                      <option value="Amiri">Amiri (أميري)</option>
                      <option value="Cairo">Cairo (كايرو)</option>
                      <option value="Tahoma">Tahoma</option>
                    </select>
                  </div>

                  {/* Language Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700">اللغة:</span>
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                    >
                      <option value="auto">لوحدها (حسب الورقة)</option>
                      <option value="ar">عربي (من اليمين)</option>
                      <option value="en">English (من الشمال)</option>
                      <option value="fr">Français (من الشمال)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700">الورقة:</span>
                    <select
                      value={landscape ? "landscape" : "portrait"}
                      onChange={(e) => setLandscape(e.target.value === "landscape")}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                    >
                      <option value="portrait">بالطول</option>
                      <option value="landscape">بالعرض</option>
                    </select>
                  </div>

                  {/* Page Border (auto-detected from the scan) */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700">البرواز:</span>
                    <select
                      value={borderStyle}
                      onChange={(e) => setBorderStyle(e.target.value as PageBorderKind)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                    >
                      <option value="none">من غير برواز</option>
                      <option value="single">خط واحد</option>
                      <option value="double">خطين</option>
                      <option value="decorative">مزخرف (للعقود)</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={boldBody}
                      onChange={(e) => setBoldBody(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <span>الكلام تقيل (Bold)</span>
                  </label>

                  <label
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none"
                    title="بيقرا الصورة تاني ويقارنها بالنص حرف بحرف. أدق بس أبطأ شوية."
                  >
                    <input
                      type="checkbox"
                      checked={verifyPass}
                      onChange={(e) => setVerifyPass(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <span>راجع مرة تانية على الصورة</span>
                  </label>
                </div>
              </div>

              {/* Document Title Input */}
              <div className="mb-3">
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                  placeholder="اسم ملف الـ Word"
                />
              </div>

              {/* Main Content Area: Visual Formatted with real tables OR Raw Textarea */}
              {viewMode === "visual" ? (
                <div
                  dir={
                    selectedLanguage === "ar"
                      ? "rtl"
                      : selectedLanguage === "en" || selectedLanguage === "fr"
                      ? "ltr"
                      : /[\u0600-\u06FF]/.test(refinedText)
                      ? "rtl"
                      : "ltr"
                  }
                  style={{
                    fontFamily:
                      selectedFont === "Traditional Arabic"
                        ? "'Traditional Arabic', Arial, sans-serif"
                        : `${selectedFont}, Arial, sans-serif`,
                  }}
                  className="w-full min-h-[380px] max-h-[600px] overflow-y-auto bg-slate-50/70 border border-slate-200 rounded-xl p-4 text-slate-900 shadow-inner"
                >
                  {renderVisualDocument(refinedText)}
                </div>
              ) : (
                <textarea
                  value={refinedText}
                  onChange={(e) => setRefinedText(e.target.value)}
                  dir={
                    selectedLanguage === "ar"
                      ? "rtl"
                      : selectedLanguage === "en" || selectedLanguage === "fr"
                      ? "ltr"
                      : /[\u0600-\u06FF]/.test(refinedText)
                      ? "rtl"
                      : "ltr"
                  }
                  style={{
                    fontFamily:
                      selectedFont === "Traditional Arabic"
                        ? "'Traditional Arabic', Arial, sans-serif"
                        : `${selectedFont}, Arial, sans-serif`,
                  }}
                  placeholder="النص هيظهر هنا بعد ما الصفحات تتقرا..."
                  rows={18}
                  className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs sm:text-sm text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:border-blue-500 resize-y ${
                    selectedLanguage === "ar" ||
                    (selectedLanguage === "auto" && /[\u0600-\u06FF]/.test(refinedText))
                      ? "text-right"
                      : "text-left"
                  }`}
                />
              )}
            </div>
          </div>
        </div>

        {/* Clean, Honest Status Footer */}
        {/* <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high/40 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-on-surface">الماسح الضوئي جاهز</span>
            <span>— معالجة فائقة الدقة للوثائق الرسمية والمخطوطات</span>
          </div>
          <span>مطبعة وخدمات كوبي كات</span>
        </div> */}
      </div>
    </div>
  );
}
