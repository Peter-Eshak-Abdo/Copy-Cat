"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ImagePlus,
  ImageUp,
  Loader2,
  Maximize,
  MoveHorizontal,
  RotateCcw,
  ScanText,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { prepareOcrImage, uprightPage } from "@/lib/ocr-client";

/**
 * "نسخ الكلمات العربي": the school sends phone photos of vocabulary pages; staff paste each Arabic meaning
 * into a Word table. Upload one or more photos and every Arabic entry gets a button right on top of it (and
 * in a list beside it): one click copies it, and the button stays ticked so you can see what you already
 * pasted. Pages are read one after another; each photo shows on screen the moment it's received.
 */
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;

interface Word {
  text: string;
  box: number[] | null; // [ymin, xmin, ymax, xmax] in 0-1000
}

type PageStatus = "received" | "queued" | "working" | "done" | "error";

interface PickerPage {
  id: string;
  name: string;
  file: File;
  /** Object URL of the raw photo at first, then the upright prepared image the boxes refer to */
  image: string;
  status: PageStatus;
  stage: string | null;
  words: Word[];
  copied: Set<number>;
  lastCopied: number | null;
  error?: string;
}

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const newId = () => Math.random().toString(36).slice(2, 9);

export default function WordPickerPage() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<PickerPage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const pagesRef = useRef<PickerPage[]>([]);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  const runningRef = useRef(false);

  const active = pages.find((p) => p.id === activeId) ?? pages[0] ?? null;
  const words = active?.words ?? [];
  const copied = active?.copied ?? new Set<number>();
  const lastCopied = active?.lastCopied ?? null;

  const patchPage = useCallback((id: string, patch: Partial<PickerPage>) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  // The photo sits in a box as tall as the screen with its own scroll; zoom 1 = photo as wide as the box
  const viewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [imgAspect, setImgAspect] = useState(1.4); // height / width
  // Content point to keep under the cursor (or the centre) across a zoom change
  const anchorRef = useRef<{ x: number; y: number; vx: number; vy: number; from: number } | null>(null);

  const zoomTo = useCallback((next: number, at?: { clientX: number; clientY: number }) => {
    const view = viewRef.current;
    const cur = zoomRef.current;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (z === cur) return;
    if (view) {
      const r = view.getBoundingClientRect();
      const vx = at ? at.clientX - r.left : view.clientWidth / 2;
      const vy = at ? at.clientY - r.top : view.clientHeight / 2;
      anchorRef.current = { x: view.scrollLeft + vx, y: view.scrollTop + vy, vx, vy, from: cur };
    }
    zoomRef.current = z;
    setZoom(z);
  }, []);

  useLayoutEffect(() => {
    const view = viewRef.current;
    const a = anchorRef.current;
    if (!view || !a) return;
    anchorRef.current = null;
    const f = zoom / a.from;
    view.scrollLeft = a.x * f - a.vx;
    view.scrollTop = a.y * f - a.vy;
  }, [zoom]);

  // Whole page visible in the box (never wider than it)
  const fitPage = () => {
    const view = viewRef.current;
    if (!view) return;
    zoomTo(Math.min(1, view.clientHeight / (view.clientWidth * imgAspect)));
    view.scrollTo({ left: 0, top: 0 });
  };

  const hasPages = pages.length > 0;

  // Ctrl + wheel (or a trackpad pinch) zooms around the cursor; a plain wheel just scrolls
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomTo(zoomRef.current * Math.exp(-e.deltaY * 0.0025), e);
    };
    view.addEventListener("wheel", onWheel, { passive: false });
    return () => view.removeEventListener("wheel", onWheel);
  }, [hasPages, zoomTo]);

  const resetZoom = () => {
    zoomRef.current = 1;
    setZoom(1);
  };

  const selectPage = (id: string) => {
    if (id === active?.id) return;
    setActiveId(id);
    resetZoom();
    viewRef.current?.scrollTo({ left: 0, top: 0 });
  };

  // Clicking a word in the list brings it into view on the photo
  const showWord = (i: number) => {
    const view = viewRef.current;
    const box = words[i]?.box;
    if (!view || !box) return;
    const w = view.clientWidth * zoom;
    const h = w * imgAspect;
    const cx = ((box[1] + box[3]) / 2000) * w;
    const cy = ((box[0] + box[2]) / 2000) * h;
    view.scrollTo({ left: cx - view.clientWidth / 2, top: cy - view.clientHeight / 2, behavior: "smooth" });
  };

  /** Read one page: upright it, then ask for the Arabic words */
  const readPage = async (page: PickerPage) => {
    const id = page.id;
    try {
      patchPage(id, { status: "working", stage: "بنجهز الصورة" });
      const raw = await readFile(page.file);
      patchPage(id, { stage: "بنعدل اتجاه الصفحة" });
      const upright = await uprightPage(raw);
      const prepared = await prepareOcrImage(upright.dataUrl, 2000);
      if (!pagesRef.current.some((p) => p.id === id)) return; // removed meanwhile
      URL.revokeObjectURL(page.image);
      patchPage(id, { image: prepared, stage: "بندوّر على الكلمات العربي" });
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "words", imageBase64: prepared }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const error = data.error || "اتأكد إن الصورة واضحة وفيها كلام عربي.";
        patchPage(id, { status: "error", stage: null, error });
        toast.error(`ملقيناش كلمات في «${page.name}»`, error);
        return;
      }
      patchPage(id, { status: "done", stage: null, words: data.words });
      toast.success("الكلمات جاهزة", `«${page.name}»: ${data.words.length} كلمة. دوس على أي كلمة تتنسخ.`);
    } catch {
      patchPage(id, { status: "error", stage: null, error: "حصلت مشكلة، جرب تاني." });
      toast.error("حصلت مشكلة", `«${page.name}»: جرب تاني.`);
    }
  };

  /** Pages are read one at a time (the AI quota is per request, and the first page is ready sooner) */
  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      for (;;) {
        const next = pagesRef.current.find((p) => p.status === "queued" || p.status === "received");
        if (!next) break;
        // The other state updates may not have reached pagesRef yet
        pagesRef.current = pagesRef.current.map((p) => (p.id === next.id ? { ...p, status: "working" } : p));
        await readPage(next);
      }
    } finally {
      runningRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (list: File[]) => {
    const imgs = list.filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) {
      toast.error("ده مش صورة", "اختار صورة الصفحة.");
      return;
    }
    if (imgs.length < list.length) toast.warning("سبنا ملفات", `${list.length - imgs.length} ملف مش صورة.`);
    // Shown on screen right away, before anything is read
    const fresh: PickerPage[] = imgs.map((file) => ({
      id: newId(),
      name: file.name,
      file,
      image: URL.createObjectURL(file),
      status: "received",
      stage: null,
      words: [],
      copied: new Set(),
      lastCopied: null,
    }));
    const all = [...pagesRef.current, ...fresh];
    pagesRef.current = all;
    setPages(all);
    if (!active) {
      setActiveId(fresh[0].id);
      resetZoom();
    }
    // Let the "received" tick play before the page turns to "working"
    window.setTimeout(() => {
      const ids = new Set(fresh.map((p) => p.id));
      pagesRef.current = pagesRef.current.map((p) => (ids.has(p.id) && p.status === "received" ? { ...p, status: "queued" } : p));
      setPages((prev) => prev.map((p) => (ids.has(p.id) && p.status === "received" ? { ...p, status: "queued" } : p)));
      runQueue();
    }, 700);
  };

  // Ctrl+V anywhere on the page adds the pasted photo(s)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((x) => x.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const copyWord = async (i: number) => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(words[i].text);
      const id = active.id;
      setPages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, copied: new Set(p.copied).add(i), lastCopied: i } : p))
      );
    } catch {
      toast.error("منسخش", "المتصفح رفض النسخ، جرب تاني.");
    }
  };

  const retryPage = (id: string) => {
    patchPage(id, { status: "queued", error: undefined });
    pagesRef.current = pagesRef.current.map((p) => (p.id === id ? { ...p, status: "queued" } : p));
    runQueue();
  };

  const removePage = (id: string) => {
    const page = pagesRef.current.find((p) => p.id === id);
    if (page?.image.startsWith("blob:")) URL.revokeObjectURL(page.image);
    const rest = pagesRef.current.filter((p) => p.id !== id);
    pagesRef.current = rest;
    setPages(rest);
    if (active?.id === id) {
      setActiveId(rest[0]?.id ?? null);
      resetZoom();
    }
  };

  const reset = () => {
    for (const p of pagesRef.current) if (p.image.startsWith("blob:")) URL.revokeObjectURL(p.image);
    pagesRef.current = [];
    setPages([]);
    setActiveId(null);
    resetZoom();
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragOver) setIsDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = [...(e.dataTransfer.files ?? [])];
    if (files.length) addFiles(files);
  };

  const queuedBefore = (id: string) => {
    let n = 0;
    for (const p of pages) {
      if (p.id === id) break;
      if (p.status === "queued" || p.status === "received" || p.status === "working") n++;
    }
    return n;
  };

  const doneCount = pages.filter((p) => p.status === "done").length;

  return (
    <div className="space-y-5" dir="rtl">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) addFiles(files);
          e.target.value = "";
        }}
      />

      {!active ? (
        <motion.div
          onClick={() => inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          tabIndex={0}
          animate={{ scale: isDragOver ? 1.015 : 1 }}
          className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
            isDragOver ? "border-amber-500 bg-amber-50" : "border-slate-300 bg-white hover:border-amber-400"
          }`}
        >
          <motion.div
            animate={isDragOver ? { y: [0, -8, 0] } : { y: 0 }}
            transition={isDragOver ? { duration: 0.8, repeat: Infinity } : undefined}
            className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3"
          >
            <ImageUp className="w-8 h-8" />
          </motion.div>
          <p className="text-lg font-black text-slate-900">
            {isDragOver ? "سيبها هنا" : "ارفع صورة صفحة الكلمات (أو كذا صورة مرة واحدة)"}
          </p>
          <p className="text-sm text-slate-500 font-medium mt-1">
            اسحبها هنا، أو دوس واختارها، أو الزقها (Ctrl+V). هيطلعلك زرار على كل كلمة عربي، دوس عليه يتنسخ.
          </p>
        </motion.div>
      ) : (
        <>
          {/* Pages strip: every uploaded photo with its state; drop more photos here too */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`bg-white rounded-2xl border-2 p-2.5 shadow-xs transition-colors ${
              isDragOver ? "border-dashed border-amber-500 bg-amber-50" : "border-transparent"
            }`}
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <AnimatePresence initial={false}>
                {pages.map((p, idx) => {
                  const isActive = p.id === active.id;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative shrink-0"
                    >
                      <button
                        type="button"
                        onClick={() => selectPage(p.id)}
                        className={`flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border-2 cursor-pointer transition-colors ${
                          isActive ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white hover:border-amber-300"
                        }`}
                        title={p.name}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-200" />
                        <span className="flex flex-col items-start leading-tight">
                          <span className="text-xs font-black text-slate-800">صفحة {idx + 1}</span>
                          <span className="text-[10px] font-bold flex items-center gap-1">
                            {p.status === "received" ? (
                              <span className="text-emerald-600 flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" /> استلمناها
                              </span>
                            ) : p.status === "queued" ? (
                              <span className="text-slate-500 flex items-center gap-0.5">
                                <Clock className="w-3 h-3" /> مستنية
                              </span>
                            ) : p.status === "working" ? (
                              <span className="text-amber-600 flex items-center gap-0.5">
                                <Loader2 className="w-3 h-3 animate-spin" /> بنقراها
                              </span>
                            ) : p.status === "done" ? (
                              <span className="text-emerald-600 flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> {p.words.length} كلمة
                                {p.copied.size > 0 ? ` · اتنسخ ${p.copied.size}` : ""}
                              </span>
                            ) : (
                              <span className="text-rose-600 flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" /> مقريتش
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removePage(p.id)}
                        className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-slate-700 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer shadow"
                        title="شيل الصورة دي"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="shrink-0 flex items-center gap-1.5 px-3 py-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50 text-xs font-bold text-slate-600 cursor-pointer"
                title="أو اسحب الصور وسيبها هنا"
              >
                <ImagePlus className="w-4 h-4" /> ضيف صور
              </button>
              <span className="text-[11px] font-bold text-slate-400 mr-auto shrink-0 px-2">
                {isDragOver ? "سيب الصور هنا" : `اتقرا ${doneCount} من ${pages.length}`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Photo with a button on every Arabic entry */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <ScanText className="w-4 h-4 text-amber-600" />
                  دوس على الكلمة اللي على الصورة تتنسخ
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5" title="Ctrl + عجلة الماوس للزوم">
                    <button
                      type="button"
                      onClick={() => zoomTo(zoom / 1.25)}
                      disabled={zoom <= MIN_ZOOM}
                      className="p-1.5 rounded-md hover:bg-white text-slate-700 disabled:opacity-40 cursor-pointer"
                      title="صغّر"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-bold text-slate-600 tabular-nums w-10 text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => zoomTo(zoom * 1.25)}
                      disabled={zoom >= MAX_ZOOM}
                      className="p-1.5 rounded-md hover:bg-white text-slate-700 disabled:opacity-40 cursor-pointer"
                      title="كبّر"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={fitPage}
                      className="p-1.5 rounded-md hover:bg-white text-slate-700 cursor-pointer"
                      title="الصفحة كلها"
                    >
                      <Maximize className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => zoomTo(1)}
                      className="p-1.5 rounded-md hover:bg-white text-slate-700 cursor-pointer"
                      title="على عرض المربع"
                    >
                      <MoveHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={reset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> امسح الكل
                  </button>
                </div>
              </div>
              <div className="relative">
                {/* As tall as the screen with its own scroll; ltr so scrolling matches the left-based word boxes */}
                <div
                  ref={viewRef}
                  dir="ltr"
                  className="w-full h-[calc(100vh-15rem)] min-h-[360px] overflow-auto rounded-xl bg-slate-100 overscroll-contain"
                >
                  <div className="relative" style={{ width: `${zoom * 100}%`, margin: zoom < 1 ? "0 auto" : undefined }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={active.image}
                      alt="صفحة الكلمات"
                      className="w-full h-auto block select-none"
                      draggable={false}
                      onLoad={(e) => {
                        const im = e.currentTarget;
                        if (im.naturalWidth) setImgAspect(im.naturalHeight / im.naturalWidth);
                      }}
                    />
                    {words.map((w, i) =>
                      w.box ? (
                        <button
                          key={i}
                          type="button"
                          title={w.text}
                          onClick={() => copyWord(i)}
                          style={{
                            top: `${w.box[0] / 10}%`,
                            left: `${w.box[1] / 10}%`,
                            height: `${Math.max(2.5, (w.box[2] - w.box[0]) / 10)}%`,
                            width: `${Math.max(3, (w.box[3] - w.box[1]) / 10)}%`,
                          }}
                          className={`absolute rounded-md border-2 transition-colors cursor-copy ${
                            lastCopied === i
                              ? "border-emerald-500 bg-emerald-400/30"
                              : copied.has(i)
                              ? "border-emerald-500/60 bg-emerald-300/15"
                              : "border-amber-500 bg-amber-300/20 hover:bg-amber-300/45"
                          }`}
                        />
                      ) : null
                    )}
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  {active.status === "received" ? (
                    // Instant "got it" so it's clear the photo arrived
                    <motion.div
                      key={`got-${active.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 rounded-xl bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 pointer-events-none"
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 420, damping: 18 }}
                        className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30"
                      >
                        <Check className="w-9 h-9 stroke-[3]" />
                      </motion.div>
                      <span className="text-base font-black text-slate-900">
                        تمام، استلمنا {pages.length > 1 ? `${pages.length} صور` : "الصورة"}
                      </span>
                    </motion.div>
                  ) : active.status === "queued" || active.status === "working" ? (
                    <motion.div
                      key={`busy-${active.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 rounded-xl bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 pointer-events-none"
                    >
                      {active.status === "working" ? (
                        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                      ) : (
                        <Clock className="w-8 h-8 text-slate-500" />
                      )}
                      <span className="text-sm font-black text-slate-800 bg-white/80 rounded-lg px-3 py-1">
                        {active.status === "working"
                          ? `${active.stage ?? "بنقرا الصفحة"}...`
                          : `مستنية دورها (قبلها ${queuedBefore(active.id)})`}
                      </span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            {/* The same words as a list */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col max-h-[calc(100vh-7rem)] xl:sticky xl:top-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-black text-slate-800">
                  كلمات صفحة {pages.findIndex((p) => p.id === active.id) + 1} ({words.length})
                </span>
                {copied.size > 0 && <span className="text-xs font-bold text-emerald-700">اتنسخ {copied.size}</span>}
              </div>
              {active.status === "error" ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-rose-600 font-bold">{active.error ?? "مقريتش الصفحة دي"}</p>
                  <button
                    type="button"
                    onClick={() => retryPage(active.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> جرب تاني
                  </button>
                </div>
              ) : words.length === 0 ? (
                <p className="text-sm text-slate-400 font-bold text-center py-8">
                  {active.status === "done" ? "مفيش كلمات" : "الكلمات هتظهر هنا أول ما الصفحة تتقرا"}
                </p>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-1.5 pl-1">
                  {words.map((w, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        copyWord(i);
                        showWord(i);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-right cursor-pointer transition-colors ${
                        lastCopied === i
                          ? "border-emerald-400 bg-emerald-50"
                          : copied.has(i)
                          ? "border-slate-200 bg-slate-50 text-slate-400"
                          : "border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50"
                      }`}
                    >
                      <span className="text-xs font-bold text-slate-400 tabular-nums w-6 shrink-0">{i + 1}</span>
                      <span
                        className={`flex-1 text-base font-bold ${
                          copied.has(i) && lastCopied !== i ? "line-through" : "text-slate-900"
                        }`}
                      >
                        {w.text}
                      </span>
                      {copied.has(i) ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
