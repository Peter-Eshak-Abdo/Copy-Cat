"use client";

import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, ImageUp, Loader2, RotateCcw, ScanText } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { prepareOcrImage, uprightPage } from "@/lib/ocr-client";

/**
 * "نسخ الكلمات العربي": the school sends a phone photo of a vocabulary page; staff paste each Arabic meaning
 * into a Word table. Upload the photo and every Arabic entry gets a button right on top of it (and in a list
 * beside it): one click copies it, and the button stays ticked so you can see what you already pasted.
 */
interface Word {
  text: string;
  box: number[] | null; // [ymin, xmin, ymax, xmax] in 0-1000
}

export default function WordPickerPage() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [copied, setCopied] = useState<Set<number>>(new Set());
  const [lastCopied, setLastCopied] = useState<number | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("ده مش صورة", "اختار صورة الصفحة.");
      return;
    }
    setWords([]);
    setCopied(new Set());
    setLastCopied(null);
    try {
      setStage("بنجهز الصورة");
      const raw = await readFile(file);
      setStage("بنعدل اتجاه الصفحة");
      const upright = await uprightPage(raw);
      const prepared = await prepareOcrImage(upright.dataUrl, 2000);
      setImage(prepared);
      setStage("بندوّر على الكلمات العربي");
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "words", imageBase64: prepared }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error("ملقيناش كلمات", data.error || "اتأكد إن الصورة واضحة وفيها كلام عربي.");
        return;
      }
      setWords(data.words);
      toast.success("الكلمات جاهزة", `${data.words.length} كلمة. دوس على أي كلمة تتنسخ.`);
    } catch {
      toast.error("حصلت مشكلة", "جرب تاني.");
    } finally {
      setStage(null);
    }
  };

  const copyWord = async (i: number) => {
    try {
      await navigator.clipboard.writeText(words[i].text);
      setCopied((prev) => new Set(prev).add(i));
      setLastCopied(i);
    } catch {
      toast.error("منسخش", "المتصفح رفض النسخ، جرب تاني.");
    }
  };

  const reset = () => {
    setImage(null);
    setWords([]);
    setCopied(new Set());
    setLastCopied(null);
  };

  return (
    <div className="space-y-5" dir="rtl">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {!image ? (
        <motion.div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onPaste={(e) => {
            const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/"));
            if (f) handleFile(f);
          }}
          tabIndex={0}
          animate={{ scale: isDragOver ? 1.01 : 1 }}
          className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
            isDragOver ? "border-amber-500 bg-amber-50" : "border-slate-300 bg-white hover:border-amber-400"
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <ImageUp className="w-8 h-8" />
          </div>
          <p className="text-lg font-black text-slate-900">ارفع صورة صفحة الكلمات</p>
          <p className="text-sm text-slate-500 font-medium mt-1">
            اسحبها هنا، أو دوس واختارها، أو الزقها (Ctrl+V). هيطلعلك زرار على كل كلمة عربي، دوس عليه يتنسخ.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Photo with a button on every Arabic entry */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                <ScanText className="w-4 h-4 text-amber-600" />
                دوس على الكلمة اللي على الصورة تتنسخ
              </span>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> صورة تانية
              </button>
            </div>
            <div className="relative w-full rounded-xl overflow-hidden bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="صفحة الكلمات" className="w-full h-auto block select-none" draggable={false} />
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
              <AnimatePresence>
                {stage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2"
                  >
                    <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                    <span className="text-sm font-black text-slate-800">{stage}...</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* The same words as a list */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black text-slate-800">الكلمات بالترتيب ({words.length})</span>
              {copied.size > 0 && (
                <span className="text-xs font-bold text-emerald-700">اتنسخ {copied.size}</span>
              )}
            </div>
            {words.length === 0 && !stage ? (
              <p className="text-sm text-slate-400 font-bold text-center py-8">مفيش كلمات</p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1.5 pl-1">
                {words.map((w, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => copyWord(i)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-right cursor-pointer transition-colors ${
                      lastCopied === i
                        ? "border-emerald-400 bg-emerald-50"
                        : copied.has(i)
                        ? "border-slate-200 bg-slate-50 text-slate-400"
                        : "border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50"
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-400 tabular-nums w-6 shrink-0">{i + 1}</span>
                    <span className={`flex-1 text-base font-bold ${copied.has(i) && lastCopied !== i ? "line-through" : "text-slate-900"}`}>
                      {w.text}
                    </span>
                    {copied.has(i) ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
