"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileDown,
  Trash2,
  RotateCw,
  Sparkles,
  ArrowRight,
  Layers,
} from "lucide-react";
import { generateIdCardsDocx } from "@/lib/docx/id-cards-docx";

interface CardItem {
  id: string;
  dataUrl: string;
  rotation: number;
}

export default function IdCardsPage() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCards((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              dataUrl: event.target!.result as string,
              rotation: 0,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const rotateCard = (id: string) => {
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== id) return card;
        const newRotation = (card.rotation + 90) % 360;

        // Apply rotation permanently on a temporary canvas so the Word generator gets the right orientation
        const img = new Image();
        img.src = card.dataUrl;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          if (newRotation === 90 || newRotation === 270) {
            canvas.width = img.height;
            canvas.height = img.width;
          } else {
            canvas.width = img.width;
            canvas.height = img.height;
          }

          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((newRotation * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);

          const rotatedDataUrl = canvas.toDataURL("image/jpeg", 0.95);
          setCards((current) =>
            current.map((c) =>
              c.id === id ? { ...c, dataUrl: rotatedDataUrl, rotation: 0 } : c
            )
          );
        };

        return card;
      })
    );
  };

  const removeCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleExportWord = async () => {
    if (cards.length === 0) return;
    setIsGenerating(true);
    try {
      const imagesBase64 = cards.map((c) => c.dataUrl);
      await generateIdCardsDocx(imagesBase64, "ID_Cards_A5_Print.docx");
    } catch (err) {
      console.error("Error generating docx:", err);
      alert("حدث خطأ أثناء إنشاء ملف الوورد");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
            <Layers className="w-3.5 h-3.5" /> طباعة البطاقات والشهادات (A5)
          </div>
          <h1 className="text-2xl font-bold text-white">مصنع البطاقات والمستندات الذكي</h1>
          <p className="text-slate-400 text-sm mt-1">
            ارفع صور وش وضهر البطاقات الشخصية، قم بتدويرها أو ترتيبها، ثم صدّرها لملف Word مقاس A5
            جاهز للطباعة الفورية.
          </p>
        </div>

        {cards.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCards([])}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-red-950/40 text-red-400 hover:bg-red-900/50 border border-red-900/50 transition"
            >
              مسح الكل
            </button>
            <button
              onClick={handleExportWord}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>{isGenerating ? "جاري التوليد..." : "تحميل ملف Word (A5)"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Upload Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-900/50 hover:bg-slate-900 rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 group"
      >
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Upload className="w-7 h-7" />
        </div>
        <div>
          <p className="text-base font-bold text-slate-200">
            اضغط هنا لاختيار صور البطاقات (وش وضهر) أو اسحبها هنا
          </p>
          <p className="text-xs text-slate-500 mt-1">يدعم JPG, PNG, WEBP - مقاس الورقة A5 مضبوط تلقائياً</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Cards List */}
      {cards.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-200">
              الصور المرفوعة ({cards.length}) - مرتبة لكل وجه صفحة A5 مستقلة
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {cards.map((card, index) => (
              <div
                key={card.id}
                className="relative bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 group shadow-md"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold bg-slate-800 px-2.5 py-1 rounded-md">
                    وجه #{index + 1}
                  </span>
                  <button
                    onClick={() => removeCard(card.id)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-44 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center p-2">
                  <img
                    src={card.dataUrl}
                    alt={`Card ${index + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <button
                  onClick={() => rotateCard(card.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                >
                  <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                  <span>تدوير 90°</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
