"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calculator as CalcIcon,
  Layers,
  Settings,
  RotateCcw,
  Plus,
  Minus,
  Check,
  Percent,
  Divide,
  X,
  Equal,
  Delete,
  Copy,
  Receipt,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface PricingConfig {
  bwSingle: number;
  bwDuplex: number;
  colorLightSingle: number;
  colorLightDuplex: number;
  colorMediumSingle: number;
  colorMediumDuplex: number;
  colorHeavySingle: number;
  colorHeavyDuplex: number;
  glossy: number;
  sticker: number;
  plasticBindingSmall: number;
  plasticBindingMed: number;
  plasticBindingLarge: number;
  wireBindingSmall: number;
  wireBindingMed: number;
  wireBindingLarge: number;
  laminationA4: number;
  laminationA5: number;
}

const DEFAULT_PRICING: PricingConfig = {
  bwSingle: 0.8,
  bwDuplex: 0.9,
  colorLightSingle: 1.0,
  colorLightDuplex: 1.25,
  colorMediumSingle: 1.5,
  colorMediumDuplex: 1.8,
  colorHeavySingle: 2.0,
  colorHeavyDuplex: 2.5,
  glossy: 10.0,
  sticker: 8.5,
  plasticBindingSmall: 10,
  plasticBindingMed: 15,
  plasticBindingLarge: 20,
  wireBindingSmall: 15,
  wireBindingMed: 20,
  wireBindingLarge: 25,
  laminationA4: 10,
  laminationA5: 6,
};

const STORAGE_KEY = "copycat_calculator_pricing_v1";

export default function SmartCalculatorPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"print" | "standard">("print");

  // Pricing State
  const [pricing, setPricing] = useState<PricingConfig>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return { ...DEFAULT_PRICING, ...JSON.parse(saved) };
        } catch {
          // ignore
        }
      }
    }
    return DEFAULT_PRICING;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempPricing, setTempPricing] = useState<PricingConfig>(pricing);

  // Print Shop Calculator Inputs
  const [pageCount, setPageCount] = useState<number>(1);
  const [copiesCount, setCopiesCount] = useState<number>(1);
  const [isDuplex, setIsDuplex] = useState<boolean>(false);
  const [paperRate, setPaperRate] = useState<number>(DEFAULT_PRICING.bwSingle);
  const [rateLabel, setRateLabel] = useState<string>("أبيض وأسود (وجه واحد)");

  // Add-ons Selection
  const [selectedAddons, setSelectedAddons] = useState<{ id: string; name: string; price: number; count: number }[]>([]);

  // Standard Calculator State
  const [calcDisplay, setCalcDisplay] = useState<string>("0");
  const [calcEquation, setCalcEquation] = useState<string>("");

  // Save Pricing changes
  const handleSavePricing = () => {
    setPricing(tempPricing);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tempPricing));
      toast.success("تم الحفظ", "تم تحديث أسعار الطباعة والتجليد بنجاح");
    } catch {
      toast.error("خطأ", "تعذر حفظ الإعدادات");
    }
    setIsSettingsOpen(false);
  };

  const handleResetDefaultPricing = () => {
    setTempPricing(DEFAULT_PRICING);
    setPricing(DEFAULT_PRICING);
    try {
      localStorage.removeItem(STORAGE_KEY);
      toast.info("تمت الاستعادة", "تمت استعادة الأسعار الافتراضية");
    } catch {
      // ignore
    }
    setIsSettingsOpen(false);
  };

  // Math Calculations for Print Shop
  const sheetCount = isDuplex ? Math.ceil(pageCount / 2) : pageCount;
  const totalSheetsForJob = sheetCount * copiesCount;
  const printCostPerBook = sheetCount * paperRate;
  const totalPrintCost = printCostPerBook * copiesCount;

  const addonsTotalCost = selectedAddons.reduce((sum, item) => sum + item.price * item.count, 0);
  const grandTotalCost = totalPrintCost + addonsTotalCost;

  // Addon handler
  const handleToggleAddon = (id: string, name: string, price: number) => {
    setSelectedAddons((prev) => {
      const exists = prev.find((a) => a.id === id);
      if (exists) {
        return prev.filter((a) => a.id !== id);
      } else {
        return [...prev, { id, name, price, count: copiesCount }];
      }
    });
  };

  const handleUpdateAddonCount = (id: string, count: number) => {
    if (count < 1) {
      setSelectedAddons((prev) => prev.filter((a) => a.id !== id));
      return;
    }
    setSelectedAddons((prev) => prev.map((a) => (a.id === id ? { ...a, count } : a)));
  };

  // Standard Calculator Logic
  const handleCalcNumber = useCallback((num: string) => {
    setCalcDisplay((prev) => (prev === "0" ? num : prev + num));
  }, []);

  const handleCalcOperator = useCallback((op: string) => {
    setCalcDisplay((prev) => {
      setCalcEquation((prevEq) => (prevEq ? `${prevEq} ${prev} ${op}` : `${prev} ${op}`));
      return "0";
    });
  }, []);

  const handleCalcClear = useCallback(() => {
    setCalcDisplay("0");
    setCalcEquation("");
  }, []);

  const handleCalcBackspace = useCallback(() => {
    setCalcDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
  }, []);

  const handleCalcCalculate = useCallback(() => {
    try {
      if (!calcEquation) return;
      const fullExpression = `${calcEquation} ${calcDisplay}`
        .replace(/×/g, "*")
        .replace(/÷/g, "/");

      // evaluate safely using Function
      const result = new Function(`return (${fullExpression})`)();
      const formatted = Number.isFinite(result) ? String(Math.round(result * 1000) / 1000) : "Error";

      setCalcEquation(`${calcEquation} ${calcDisplay} =`);
      setCalcDisplay(formatted);
    } catch {
      setCalcDisplay("Error");
    }
  }, [calcEquation, calcDisplay]);

  // Global Keyboard Listener for Standard Calculator & Quick Numpad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "standard") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleCalcNumber(e.key);
      } else if (e.key === ".") {
        e.preventDefault();
        if (!calcDisplay.includes(".")) handleCalcNumber(".");
      } else if (e.key === "+") {
        e.preventDefault();
        handleCalcOperator("+");
      } else if (e.key === "-") {
        e.preventDefault();
        handleCalcOperator("-");
      } else if (e.key === "*") {
        e.preventDefault();
        handleCalcOperator("×");
      } else if (e.key === "/") {
        e.preventDefault();
        handleCalcOperator("÷");
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        handleCalcCalculate();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleCalcBackspace();
      } else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleCalcClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, calcDisplay, handleCalcCalculate, handleCalcClear, handleCalcBackspace, handleCalcNumber, handleCalcOperator]);

  // Copy Receipt summary
  const handleCopyReceipt = async () => {
    let text = `🧾 *تفاصيل حساب الطباعة (Copy-Cat)*\n`;
    text += `------------------------------------\n`;
    text += `• عدد الصفحات الأصلية: ${pageCount} صفحة\n`;
    text += `• طريقة الطباعة: ${isDuplex ? "وجه وظهر (Duplex)" : "وجه واحد (Single)"}\n`;
    text += `• عدد الورق الفعلي لكل نسخة: ${sheetCount} ورقة\n`;
    text += `• عدد النسخ المطلوبة: ${copiesCount} نسخة\n`;
    text += `• إجمالي الورق المستهلك: ${totalSheetsForJob} ورقة\n`;
    text += `• سعر الورقة (${rateLabel}): ${paperRate.toFixed(2)} ج.م\n`;
    text += `• تكلفة الطباعة فقط: ${totalPrintCost.toFixed(2)} ج.م\n`;

    if (selectedAddons.length > 0) {
      text += `\n📦 *إضافات وتجليد:*\n`;
      selectedAddons.forEach((a) => {
        text += `  - ${a.name} × ${a.count} = ${(a.price * a.count).toFixed(2)} ج.م\n`;
      });
      text += `• إجمالي الإضافات: ${addonsTotalCost.toFixed(2)} ج.م\n`;
    }

    text += `------------------------------------\n`;
    text += `💰 *الإجمالي النهائي المطلوب: ${grandTotalCost.toFixed(2)} ج.م*\n`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success("تم النسخ", "تم نسخ الفاتورة التقديرية لمشاركتها مع العميل");
    } catch {
      toast.error("خطأ", "تعذر النسخ");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <CalcIcon className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">حاسبة المطبعة والملازم الذكية (Smart Calculator)</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            حساب دقيق لورق الملازم والكتب (وش وظهر / وجه واحد)، أزرار تسعير جاهزة ومخصصة، وإضافات التجليد والسلوفان مع حاسبة عامة سريعة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-muted/40 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab("print")}
              className={`px-3.5 py-2 rounded-lg transition ${
                activeTab === "print"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              حاسبة الملازم والطباعة
            </button>
            <button
              onClick={() => setActiveTab("standard")}
              className={`px-3.5 py-2 rounded-lg transition ${
                activeTab === "standard"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              حاسبة عامة (Numpad)
            </button>
          </div>

          <button
            onClick={() => {
              setTempPricing(pricing);
              setIsSettingsOpen(true);
            }}
            className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition border border-border"
            title="تعديل جدول الأسعار"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "print" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Job Inputs & Presets (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Input parameters card */}
            <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2 pb-2 border-b border-border">
                <Layers className="w-4 h-4 text-primary" />
                بيانات المذكرة أو المستند
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Page Count */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    عدد الصفحات في الملف (PDF / Word)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={pageCount}
                    onChange={(e) => setPageCount(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 text-base font-bold rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    مثال: ملف فيه 123 صفحة
                  </span>
                </div>

                {/* Copies Count */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    عدد النسخ المطلوبة
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={copiesCount}
                    onChange={(e) => setCopiesCount(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 text-base font-bold rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    عدد الملازم أو الكتب للعميل
                  </span>
                </div>
              </div>

              {/* Duplex Toggle Button */}
              <div className="pt-2">
                <label className="text-xs font-semibold text-foreground mb-2 block">نوع الطباعة:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDuplex(false);
                      if (paperRate === pricing.bwDuplex) {
                        setPaperRate(pricing.bwSingle);
                        setRateLabel("أبيض وأسود (وجه واحد)");
                      }
                    }}
                    className={`p-3 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition ${
                      !isDuplex
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border text-foreground hover:bg-muted/40"
                    }`}
                  >
                    وجه واحد (Single-Sided)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDuplex(true);
                      if (paperRate === pricing.bwSingle) {
                        setPaperRate(pricing.bwDuplex);
                        setRateLabel("أبيض وأسود (وش وظهر)");
                      }
                    }}
                    className={`p-3 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition ${
                      isDuplex
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border text-foreground hover:bg-muted/40"
                    }`}
                  >
                    وش وظهر (Duplex)
                  </button>
                </div>

                {/* Live Duplex Info Alert */}
                <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs text-foreground flex items-center justify-between">
                  <span>
                    النتيجة الحسابية: {pageCount} صفحة {isDuplex ? "وش وظهر = " : "وجه واحد = "}
                    <strong className="text-primary font-bold text-sm"> {sheetCount} ورقة </strong>
                    لكل نسخة
                  </span>
                  <span className="text-muted-foreground">
                    إجمالي للأوردر: <strong>{totalSheetsForJob} ورقة</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Pricing Presets Buttons */}
            <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-foreground pb-2 border-b border-border flex items-center justify-between">
                <span>أزرار تسعير الورقة والطباعة</span>
                <span className="text-xs font-normal text-muted-foreground">المحدد حالياً: {rateLabel} ({paperRate} ج.م)</span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                {/* B&W Single */}
                <button
                  type="button"
                  onClick={() => {
                    setPaperRate(pricing.bwSingle);
                    setRateLabel("أبيض وأسود (وجه واحد)");
                    setIsDuplex(false);
                  }}
                  className={`p-2.5 rounded-xl border text-right transition ${
                    paperRate === pricing.bwSingle && !isDuplex
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <div className="text-xs">أبيض وأسود (وجه)</div>
                  <div className="text-sm font-bold mt-0.5">{pricing.bwSingle.toFixed(2)} ج.م</div>
                </button>

                {/* B&W Duplex */}
                <button
                  type="button"
                  onClick={() => {
                    setPaperRate(pricing.bwDuplex);
                    setRateLabel("أبيض وأسود (وش وظهر)");
                    setIsDuplex(true);
                  }}
                  className={`p-2.5 rounded-xl border text-right transition ${
                    paperRate === pricing.bwDuplex && isDuplex
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <div className="text-xs">أبيض وأسود (وش وظهر)</div>
                  <div className="text-sm font-bold mt-0.5">{pricing.bwDuplex.toFixed(2)} ج.م</div>
                </button>

                {/* Light Color */}
                <button
                  type="button"
                  onClick={() => {
                    const r = isDuplex ? pricing.colorLightDuplex : pricing.colorLightSingle;
                    setPaperRate(r);
                    setRateLabel(`ألوان خفيف (${isDuplex ? "وش وظهر" : "وجه"})`);
                  }}
                  className={`p-2.5 rounded-xl border text-right transition ${
                    paperRate === (isDuplex ? pricing.colorLightDuplex : pricing.colorLightSingle)
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <div className="text-xs">ألوان خفيف / هيدر</div>
                  <div className="text-sm font-bold mt-0.5">
                    {(isDuplex ? pricing.colorLightDuplex : pricing.colorLightSingle).toFixed(2)} ج.م
                  </div>
                </button>

                {/* Medium Color */}
                <button
                  type="button"
                  onClick={() => {
                    const r = isDuplex ? pricing.colorMediumDuplex : pricing.colorMediumSingle;
                    setPaperRate(r);
                    setRateLabel(`ألوان متوسط (${isDuplex ? "وش وظهر" : "وجه"})`);
                  }}
                  className={`p-2.5 rounded-xl border text-right transition ${
                    paperRate === (isDuplex ? pricing.colorMediumDuplex : pricing.colorMediumSingle)
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <div className="text-xs">ألوان متوسط (ملازم)</div>
                  <div className="text-sm font-bold mt-0.5">
                    {(isDuplex ? pricing.colorMediumDuplex : pricing.colorMediumSingle).toFixed(2)} ج.م
                  </div>
                </button>

                {/* Heavy Color */}
                <button
                  type="button"
                  onClick={() => {
                    const r = isDuplex ? pricing.colorHeavyDuplex : pricing.colorHeavySingle;
                    setPaperRate(r);
                    setRateLabel(`ألوان كامل / ثقيل (${isDuplex ? "وش وظهر" : "وجه"})`);
                  }}
                  className={`p-2.5 rounded-xl border text-right transition ${
                    paperRate === (isDuplex ? pricing.colorHeavyDuplex : pricing.colorHeavySingle)
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <div className="text-xs">ألوان ثقيل / تغطية</div>
                  <div className="text-sm font-bold mt-0.5">
                    {(isDuplex ? pricing.colorHeavyDuplex : pricing.colorHeavySingle).toFixed(2)} ج.م
                  </div>
                </button>

                {/* Glossy / Sticker */}
                <button
                  type="button"
                  onClick={() => {
                    setPaperRate(pricing.glossy);
                    setRateLabel("كوشيه جلوسي ملون");
                    setIsDuplex(false);
                  }}
                  className={`p-2.5 rounded-xl border text-right transition ${
                    paperRate === pricing.glossy
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <div className="text-xs">كوشيه / جلوسي</div>
                  <div className="text-sm font-bold mt-0.5">{pricing.glossy.toFixed(2)} ج.م</div>
                </button>
              </div>

              {/* Custom price manual input */}
              <div className="pt-2 flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">أو سعر ورقة يدوي:</span>
                <input
                  type="number"
                  step="0.05"
                  value={paperRate}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setPaperRate(val);
                    setRateLabel("سعر ورقة مخصص");
                  }}
                  className="w-28 px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
                />
                <span className="text-xs text-muted-foreground">ج.م للورقة</span>
              </div>
            </div>

            {/* Finishing & Binding Add-ons */}
            <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-foreground pb-2 border-b border-border">
                خدمات التجليد والتشطيب (Add-ons)
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[
                  { id: "plast-sm", name: "بلاستيك صغير", price: pricing.plasticBindingSmall },
                  { id: "plast-md", name: "بلاستيك وسط", price: pricing.plasticBindingMed },
                  { id: "plast-lg", name: "بلاستيك كبير", price: pricing.plasticBindingLarge },
                  { id: "wire-sm", name: "سلك صغير", price: pricing.wireBindingSmall },
                  { id: "wire-md", name: "سلك وسط", price: pricing.wireBindingMed },
                  { id: "wire-lg", name: "سلك كبير", price: pricing.wireBindingLarge },
                  { id: "lam-a4", name: "سلوفان A4", price: pricing.laminationA4 },
                  { id: "lam-a5", name: "سلوفان A5", price: pricing.laminationA5 },
                ].map((item) => {
                  const isSelected = selectedAddons.some((a) => a.id === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggleAddon(item.id, item.name, item.price)}
                      className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                          : "border-border hover:bg-muted/40 text-foreground"
                      }`}
                    >
                      <div>
                        <div>{item.name}</div>
                        <div className="text-[11px] opacity-80">{item.price} ج.م</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-500" />}
                    </button>
                  );
                })}
              </div>

              {/* Selected addons count adjustments */}
              {selectedAddons.length > 0 && (
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">كميات الإضافات المختارة:</div>
                  {selectedAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-xl text-xs"
                    >
                      <span className="font-medium text-foreground">
                        {addon.name} ({addon.price} ج.م)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateAddonCount(addon.id, addon.count - 1)}
                          className="w-6 h-6 rounded bg-background border border-border flex items-center justify-center font-bold"
                        >
                          -
                        </button>
                        <span className="font-bold px-1">{addon.count}</span>
                        <button
                          onClick={() => handleUpdateAddonCount(addon.id, addon.count + 1)}
                          className="w-6 h-6 rounded bg-background border border-border flex items-center justify-center font-bold"
                        >
                          +
                        </button>
                        <span className="font-bold mr-2 text-primary">
                          = {(addon.price * addon.count).toFixed(2)} ج.م
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Bill & Receipt (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 shadow-sm space-y-5 sticky top-6">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg text-foreground">ملخص الفاتورة التقديرية</h2>
                </div>
                <button
                  onClick={handleCopyReceipt}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold transition"
                  title="نسخ الفاتورة للعميل"
                >
                  <Copy className="w-3.5 h-3.5" />
                  نسخ الفاتورة
                </button>
              </div>

              {/* Bill Line Items */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>عدد الصفحات الأصلية:</span>
                  <span className="font-bold text-foreground">{pageCount} صفحة</span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>نوع الطباعة:</span>
                  <span className="font-bold text-foreground">
                    {isDuplex ? "وش وظهر (Duplex)" : "وجه واحد (Single)"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>الورق لكل نسخة:</span>
                  <span className="font-bold text-foreground">{sheetCount} ورقة</span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>عدد النسخ:</span>
                  <span className="font-bold text-foreground">{copiesCount} نسخة</span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>إجمالي الورق المستخدم:</span>
                  <span className="font-bold text-primary">{totalSheetsForJob} ورقة</span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>سعر الورقة ({rateLabel}):</span>
                  <span className="font-bold text-foreground">{paperRate.toFixed(2)} ج.م</span>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between font-semibold text-foreground">
                  <span>تكلفة الطباعة:</span>
                  <span>{totalPrintCost.toFixed(2)} ج.م</span>
                </div>

                {selectedAddons.length > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>إجمالي التجليد والإضافات:</span>
                    <span className="font-semibold text-foreground">{addonsTotalCost.toFixed(2)} ج.م</span>
                  </div>
                )}
              </div>

              {/* Grand Total Highlight Box */}
              <div className="p-4 rounded-2xl bg-linear-to-br from-primary/15 via-primary/5 to-transparent border border-primary/30 text-center space-y-1">
                <div className="text-xs text-muted-foreground font-semibold">الإجمالي النهائي المطلوب</div>
                <div className="text-3xl font-black text-primary tracking-tight">
                  {grandTotalCost.toFixed(2)} <span className="text-base font-bold">ج.م</span>
                </div>
                {copiesCount > 1 && (
                  <div className="text-xs text-muted-foreground pt-1">
                    (سعر النسخة الواحدة بالتجليد: {(grandTotalCost / copiesCount).toFixed(2)} ج.م)
                  </div>
                )}
              </div>

              {/* Reset button */}
              <button
                onClick={() => {
                  setPageCount(1);
                  setCopiesCount(1);
                  setIsDuplex(false);
                  setPaperRate(pricing.bwSingle);
                  setRateLabel("أبيض وأسود (وجه واحد)");
                  setSelectedAddons([]);
                }}
                className="w-full py-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                تصفير الحسابات والبدء من جديد
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Standard Calculator Mode with Full Numpad Support */
        <div className="max-w-md mx-auto bg-card/80 backdrop-blur-md border border-border rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h2 className="text-base font-bold text-foreground">حاسبة عامة سريعة</h2>
            <span className="text-xs text-muted-foreground">يدعم لوحة الأرقام (Numpad)</span>
          </div>

          {/* Calculator Screen */}
          <div className="p-4 bg-muted/40 rounded-2xl border border-border text-left font-mono space-y-1" dir="ltr">
            <div className="text-xs text-muted-foreground h-5 overflow-hidden text-ellipsis">
              {calcEquation}
            </div>
            <div className="text-3xl font-bold text-foreground overflow-x-auto whitespace-nowrap">
              {calcDisplay}
            </div>
          </div>

          {/* Keypad Grid */}
          <div className="grid grid-cols-4 gap-2.5" dir="ltr">
            <button
              onClick={handleCalcClear}
              className="p-3.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold transition text-base"
            >
              C
            </button>
            <button
              onClick={handleCalcBackspace}
              className="p-3.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold transition text-base flex items-center justify-center"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                const val = Number(calcDisplay);
                if (!isNaN(val)) setCalcDisplay(String(val / 100));
              }}
              className="p-3.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold transition text-base flex items-center justify-center"
            >
              <Percent className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleCalcOperator("÷")}
              className="p-3.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold transition text-base flex items-center justify-center"
            >
              <Divide className="w-4 h-4" />
            </button>

            {/* Row 2 */}
            <button
              onClick={() => handleCalcNumber("7")}
              className="p-3.5 rounded-xl bg-card border border-border hover:bg-muted/50 text-foreground font-bold transition text-lg"
            >
              7
            </button>
            <button
              onClick={() => handleCalcNumber("8")}
              className="p-3.5 rounded-xl bg-card border border-border hover:bg-muted/50 text-foreground font-bold transition text-lg"
            >
              8
            </button>
            <button
              onClick={() => handleCalcNumber("9")}
              className="p-3.5 rounded-xl bg-card border border-border hover:bg-muted/50 text-foreground font-bold transition text-lg"
            >
              9
            </button>
            <button
              onClick={() => handleCalcOperator("×")}
              className="p-3.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold transition text-base flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Row 3 */}
            <button
              onClick={() => handleCalcNumber("4")}
              className="p-3.5 rounded-xl bg-card border border-border hover:bg-muted/50 text-foreground font-bold transition text-lg"
            >
              4
            </button>
            <button
              onClick={() => handleCalcNumber("5")}
              className="p-3.5 rounded-xl bg-card border border-border hover:bg-muted/50 text-foreground font-bold transition text-lg"
            >
              5
            </button>
            <button
              onClick={() => handleCalcNumber("6")}
              className="p-3.5 rounded-xl bg-card border border-border hover:bg-muted/50 text-foreground font-bold transition text-lg"
            >
              6
            </button>
            <button
              onClick={() => handleCalcOperator("-")}
              className="p-3.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold transition text-base flex items-center justify-center"
            >
              <Minus className="w-4 h-4" />
            </button>

            {/* Row 4 */}
            <button
              onClick={() => handleCalcNumber("1")}
              className="p-3.5 rounded-xl bg-card border border-border hover:bg-muted/50 text-foreground font-bold transition text-lg"
            >
              1
            </button>
            <button
              onClick={() => handleCalcNumber("2")}
              className="p-3.5 rounded-xl bg-card border border-border hover:bg-muted/50 text-foreground font-bold transition text-lg"
            >
              2
            </button>
            <button
              onClick={() => handleCalcNumber("3")}
              className="p-3.5 rounded-xl bg-card border border-border hover:bg-muted/50 text-foreground font-bold transition text-lg"
            >
              3
            </button>
            <button
              onClick={() => handleCalcOperator("+")}
              className="p-3.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold transition text-base flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Row 5 */}
            <button
              onClick={() => handleCalcNumber("0")}
              className="p-3.5 rounded-xl bg-card border border-border hover:bg-muted/50 text-foreground font-bold transition text-lg col-span-2"
            >
              0
            </button>
            <button
              onClick={() => {
                if (!calcDisplay.includes(".")) handleCalcNumber(".");
              }}
              className="p-3.5 rounded-xl bg-card border border-border hover:bg-muted/50 text-foreground font-bold transition text-lg"
            >
              .
            </button>
            <button
              onClick={handleCalcCalculate}
              className="p-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold transition text-lg flex items-center justify-center shadow-md"
            >
              <Equal className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Pricing Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">إعدادات أسعار الطباعة والتجليد الافتراضية</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-sm">
              <p className="text-xs text-muted-foreground">
                يمكنك تخصيص أسعار الطباعة والتجليد لتتناسب مع تكاليف وأسعار مكتبتك. سيتم حفظها محلياً على جهازك.
              </p>

              {/* Rates Group: B&W and Color */}
              <div className="space-y-3">
                <h3 className="font-bold text-foreground text-xs uppercase tracking-wider text-primary">
                  أسعار الطباعة للورقة (ج.م)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">أبيض وأسود وجه واحد:</label>
                    <input
                      type="number"
                      step="0.05"
                      value={tempPricing.bwSingle}
                      onChange={(e) => setTempPricing({ ...tempPricing, bwSingle: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">أبيض وأسود وش وظهر:</label>
                    <input
                      type="number"
                      step="0.05"
                      value={tempPricing.bwDuplex}
                      onChange={(e) => setTempPricing({ ...tempPricing, bwDuplex: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">ألوان خفيف (وجه / وش وظهر):</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.05"
                        value={tempPricing.colorLightSingle}
                        onChange={(e) => setTempPricing({ ...tempPricing, colorLightSingle: Number(e.target.value) })}
                        className="w-1/2 px-3 py-1.5 rounded-lg border border-border bg-background"
                        placeholder="وجه"
                      />
                      <input
                        type="number"
                        step="0.05"
                        value={tempPricing.colorLightDuplex}
                        onChange={(e) => setTempPricing({ ...tempPricing, colorLightDuplex: Number(e.target.value) })}
                        className="w-1/2 px-3 py-1.5 rounded-lg border border-border bg-background"
                        placeholder="وش وظهر"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">ألوان متوسط (وجه / وش وظهر):</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.05"
                        value={tempPricing.colorMediumSingle}
                        onChange={(e) => setTempPricing({ ...tempPricing, colorMediumSingle: Number(e.target.value) })}
                        className="w-1/2 px-3 py-1.5 rounded-lg border border-border bg-background"
                        placeholder="وجه"
                      />
                      <input
                        type="number"
                        step="0.05"
                        value={tempPricing.colorMediumDuplex}
                        onChange={(e) => setTempPricing({ ...tempPricing, colorMediumDuplex: Number(e.target.value) })}
                        className="w-1/2 px-3 py-1.5 rounded-lg border border-border bg-background"
                        placeholder="وش وظهر"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">كوشيه جلوسي:</label>
                    <input
                      type="number"
                      step="0.5"
                      value={tempPricing.glossy}
                      onChange={(e) => setTempPricing({ ...tempPricing, glossy: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">ورق استيكر لاصق:</label>
                    <input
                      type="number"
                      step="0.5"
                      value={tempPricing.sticker}
                      onChange={(e) => setTempPricing({ ...tempPricing, sticker: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Rates Group: Binding */}
              <div className="space-y-3 pt-3 border-t border-border">
                <h3 className="font-bold text-foreground text-xs uppercase tracking-wider text-primary">
                  أسعار التجليد والسلوفان (ج.م)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">تجليد بلاستيك (صغير / وسط / كبير):</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={tempPricing.plasticBindingSmall}
                        onChange={(e) => setTempPricing({ ...tempPricing, plasticBindingSmall: Number(e.target.value) })}
                        className="w-1/3 px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
                      />
                      <input
                        type="number"
                        value={tempPricing.plasticBindingMed}
                        onChange={(e) => setTempPricing({ ...tempPricing, plasticBindingMed: Number(e.target.value) })}
                        className="w-1/3 px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
                      />
                      <input
                        type="number"
                        value={tempPricing.plasticBindingLarge}
                        onChange={(e) => setTempPricing({ ...tempPricing, plasticBindingLarge: Number(e.target.value) })}
                        className="w-1/3 px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">تجليد سلك معدني (صغير / وسط / كبير):</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={tempPricing.wireBindingSmall}
                        onChange={(e) => setTempPricing({ ...tempPricing, wireBindingSmall: Number(e.target.value) })}
                        className="w-1/3 px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
                      />
                      <input
                        type="number"
                        value={tempPricing.wireBindingMed}
                        onChange={(e) => setTempPricing({ ...tempPricing, wireBindingMed: Number(e.target.value) })}
                        className="w-1/3 px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
                      />
                      <input
                        type="number"
                        value={tempPricing.wireBindingLarge}
                        onChange={(e) => setTempPricing({ ...tempPricing, wireBindingLarge: Number(e.target.value) })}
                        className="w-1/3 px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">سلوفان حراري A4:</label>
                    <input
                      type="number"
                      value={tempPricing.laminationA4}
                      onChange={(e) => setTempPricing({ ...tempPricing, laminationA4: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">سلوفان حراري A5:</label>
                    <input
                      type="number"
                      value={tempPricing.laminationA5}
                      onChange={(e) => setTempPricing({ ...tempPricing, laminationA5: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
              <button
                type="button"
                onClick={handleResetDefaultPricing}
                className="text-xs text-destructive hover:underline"
              >
                استعادة الأسعار الافتراضية
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 text-xs text-muted-foreground hover:bg-muted rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePricing}
                  className="px-5 py-2 text-xs bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition shadow-md"
                >
                  حفظ الأسعار
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
