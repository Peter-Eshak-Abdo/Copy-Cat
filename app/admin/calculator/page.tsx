"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  wireBindingSmall: number;
  wireBindingMed: number;
  wireBindingLarge: number;
  plasticBindingSmall: number;
  plasticBindingMed: number;
  plasticBindingLarge: number;
  cellophane: number;
  glue: number;
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
  wireBindingSmall: 15,
  wireBindingMed: 20,
  wireBindingLarge: 25,
  plasticBindingSmall: 10,
  plasticBindingMed: 15,
  plasticBindingLarge: 20,
  cellophane: 5,
  glue: 12,
};

const STORAGE_KEY = "copycat_calculator_pricing_v1";

export default function SmartCalculatorPage() {
  const toast = useToast();

  // Mode: print calculator or quick numpad
  const [activeTab, setActiveTab] = useState<"print" | "numpad">("print");

  // Pricing configuration loaded from localStorage
  const [pricing, setPricing] = useState<PricingConfig>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return { ...DEFAULT_PRICING, ...JSON.parse(saved) };
        } catch {}
      }
    }
    return DEFAULT_PRICING;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempPricing, setTempPricing] = useState<PricingConfig>(pricing);

  // Core Job Inputs
  const [pageCount, setPageCount] = useState<number>(120);
  const [copiesCount, setCopiesCount] = useState<number>(50);
  const [isDuplex, setIsDuplex] = useState<boolean>(true);
  const [paperRate, setPaperRate] = useState<number>(DEFAULT_PRICING.bwDuplex);
  const [rateLabel, setRateLabel] = useState<string>("أبيض وأسود (وش وظهر)");

  // Binding selections
  const [selectedBinding, setSelectedBinding] = useState<{ name: string; price: number } | null>({
    name: "سلك معدني وسط (حتى 120 ورقة)",
    price: DEFAULT_PRICING.wireBindingMed,
  });

  // Extras toggles
  const [extraCellophane, setExtraCellophane] = useState<boolean>(false);
  const [extraGlue, setExtraGlue] = useState<boolean>(false);

  // Numpad Calculator State
  const [numpadDisplay, setNumpadDisplay] = useState<string>("0");
  const [numpadEquation, setNumpadEquation] = useState<string>("");

  // Mathematical Calculations
  const sheetCountPerCopy = useMemo(() => {
    return isDuplex ? Math.ceil(pageCount / 2) : pageCount;
  }, [pageCount, isDuplex]);

  const totalSheetsOrder = useMemo(() => {
    return sheetCountPerCopy * copiesCount;
  }, [sheetCountPerCopy, copiesCount]);

  const packetsA4Count = useMemo(() => {
    return (totalSheetsOrder / 500).toFixed(1).replace(/\.0$/, "");
  }, [totalSheetsOrder]);

  const printCostPerCopy = useMemo(() => {
    return sheetCountPerCopy * paperRate;
  }, [sheetCountPerCopy, paperRate]);

  const bindingCostPerCopy = useMemo(() => {
    let cost = selectedBinding ? selectedBinding.price : 0;
    if (extraCellophane) cost += pricing.cellophane;
    if (extraGlue) cost += pricing.glue;
    return cost;
  }, [selectedBinding, extraCellophane, extraGlue, pricing.cellophane, pricing.glue]);

  const singleCopyTotalCost = useMemo(() => {
    return printCostPerCopy + bindingCostPerCopy;
  }, [printCostPerCopy, bindingCostPerCopy]);

  const grandTotalCost = useMemo(() => {
    return singleCopyTotalCost * copiesCount;
  }, [singleCopyTotalCost, copiesCount]);

  // Estimated production paper/toner cost (~52% baseline for print houses)
  const estProductionCost = useMemo(() => {
    return Math.round(grandTotalCost * 0.52);
  }, [grandTotalCost]);

  const profitMarginPercent = useMemo(() => {
    if (grandTotalCost <= 0) return 0;
    return Math.round(((grandTotalCost - estProductionCost) / grandTotalCost) * 100);
  }, [grandTotalCost, estProductionCost]);

  // Quick preset selections
  const handlePresetSelect = (rate: number, label: string) => {
    setPaperRate(rate);
    setRateLabel(label);
  };

  // Numpad actions
  const handleNumpadNum = useCallback((num: string) => {
    setNumpadDisplay((prev) => (prev === "0" ? num : prev + num));
  }, []);

  const handleNumpadAction = useCallback((op: string) => {
    if (op === "C") {
      setNumpadDisplay("0");
      setNumpadEquation("");
    } else if (op === "DEL") {
      setNumpadDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    } else {
      setNumpadDisplay((prev) => {
        setNumpadEquation((prevEq) => (prevEq ? `${prevEq} ${prev} ${op}` : `${prev} ${op}`));
        return "0";
      });
    }
  }, []);

  const handleNumpadEquals = useCallback(() => {
    try {
      if (!numpadEquation) return;
      const expr = `${numpadEquation} ${numpadDisplay}`.replace(/×/g, "*").replace(/÷/g, "/");
      const result = new Function(`return (${expr})`)();
      if (Number.isFinite(result)) {
        setNumpadEquation(`${numpadEquation} ${numpadDisplay} =`);
        setNumpadDisplay(String(Math.round(result * 1000) / 1000));
      } else {
        setNumpadDisplay("Error");
      }
    } catch {
      setNumpadDisplay("Error");
    }
  }, [numpadEquation, numpadDisplay]);

  // Keyboard listener for Numpad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "numpad") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleNumpadNum(e.key);
      } else if (e.key === ".") {
        e.preventDefault();
        if (!numpadDisplay.includes(".")) handleNumpadNum(".");
      } else if (e.key === "+") {
        e.preventDefault();
        handleNumpadAction("+");
      } else if (e.key === "-") {
        e.preventDefault();
        handleNumpadAction("-");
      } else if (e.key === "*") {
        e.preventDefault();
        handleNumpadAction("×");
      } else if (e.key === "/") {
        e.preventDefault();
        handleNumpadAction("÷");
      } else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        handleNumpadEquals();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleNumpadAction("DEL");
      } else if (e.key === "Escape" || e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleNumpadAction("C");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, numpadDisplay, handleNumpadNum, handleNumpadAction, handleNumpadEquals]);

  // Copy invoice text
  const handleCopyInvoice = async () => {
    let text = `🧾 *عرض سعر وتكلفة طباعة | مكتبة كوبي كات Copy Cat*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `• عدد صفحات الملف: ${pageCount} صفحة أصلية\n`;
    text += `• طريقة الطباعة: ${isDuplex ? "وش وظهر (Duplex) توفير 50% ورق" : "وجه واحد (Single-Sided)"}\n`;
    text += `• الورق الفعلي لكل نسخة: ${sheetCountPerCopy} ورقة\n`;
    text += `• عدد النسخ المطلوبة: ${copiesCount} نسخة\n`;
    text += `• إجمالي الورق المستهلك: ${totalSheetsOrder.toLocaleString("ar-EG")} ورقة (حوالي ${packetsA4Count} باكيت A4)\n`;
    text += `• سعر الورقة (${rateLabel}): ${paperRate.toFixed(2)} ج.م\n`;
    text += `• تكلفة الطباعة للنسخة: ${printCostPerCopy.toFixed(2)} ج.م\n`;
    if (selectedBinding) {
      text += `• التجليد والتشطيب: ${selectedBinding.name} (${selectedBinding.price} ج.م)\n`;
    }
    if (extraCellophane) text += `• إضافة سلوفان حراري: +${pricing.cellophane} ج.م\n`;
    if (extraGlue) text += `• إضافة غراء حراري: +${pricing.glue} ج.م\n`;
    text += `• إجمالي سعر النسخة الواحدة: ${singleCopyTotalCost.toFixed(2)} ج.م\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 *الإجمالي النهائي المطلوب: ${grandTotalCost.toLocaleString("ar-EG")} ج.م*\n`;
    text += `📍 شارع الدقهلية بالقرب من مسجد المطافي أمام مركز نور الحياة - عرايشية مصر - الإسماعيلية | هاتف: 01210571251\n`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success("تم نسخ الفاتورة", "تم نسخ ملخص عرض السعر بنجاح لمشاركته مع العميل");
    } catch {
      toast.error("خطأ", "تعذر نسخ النص للحافظة");
    }
  };

  // WhatsApp Quote Share
  const handleSendWhatsappQuote = () => {
    let msg = `مرحباً بك، تفاصيل عرض سعر الطباعة الخاص بك من مطبعة كوبي كات:\n\n`;
    msg += `📄 *${pageCount} صفحة* (${isDuplex ? "وش وظهر" : "وجه واحد"})\n`;
    msg += `📦 الكمية: *${copiesCount} نسخة*\n`;
    if (selectedBinding) msg += `📚 التجليد: ${selectedBinding.name}\n`;
    msg += `💵 سعر النسخة: *${singleCopyTotalCost.toFixed(2)} ج.م*\n`;
    msg += `✨ *الإجمالي الكلي: ${grandTotalCost.toLocaleString("ar-EG")} ج.م*\n\n`;
    msg += `جاهزون للطباعة الفورية والتسليم في الموعد المحدد بإذن الله.`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // Transfer Directly to Shift Tasks in LocalStorage
  const handleTransferToShiftOrder = () => {
    try {
      const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const newTask = {
        id: orderId,
        title: `ملزمة/مستند (${pageCount} ص - ${isDuplex ? "وش وظهر" : "وجه واحد"}) ${selectedBinding ? "+ " + selectedBinding.name : ""}`,
        customerName: "عميل حاسبة الشفت",
        phone: "",
        deadline: "اليوم",
        totalCopies: copiesCount,
        completedCopies: 0,
        bindingType: selectedBinding?.name || "ورق فرط",
        notes: `ورق مستخدم: ${totalSheetsOrder} ورقة (${packetsA4Count} باكيت) | سعر النسخة: ${singleCopyTotalCost.toFixed(2)} ج.م | الإجمالي: ${grandTotalCost.toFixed(2)} ج.م`,
        status: "in_progress" as const,
        createdAt: Date.now(),
      };

      const saved = localStorage.getItem("copycat_tasks_v1");
      let currentTasks: unknown[] = [];
      if (saved) {
        try {
          currentTasks = JSON.parse(saved);
        } catch {}
      }
      const updated = [newTask, ...(Array.isArray(currentTasks) ? currentTasks : [])];
      localStorage.setItem("copycat_tasks_v1", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      toast.success(
        "تم تحويل الأوردر للشفت",
        `تم تسجيل المهمة #${newTask.id} بنجاح وقيدها في قائمة مهام وأوردرات الشفت الحالية`
      );
    } catch {
      toast.error("خطأ", "تعذر تحويل الأوردر إلى مهام الشفت");
    }
  };

  // Reset Calculator
  const handleReset = () => {
    setPageCount(120);
    setCopiesCount(50);
    setIsDuplex(true);
    setPaperRate(pricing.bwDuplex);
    setRateLabel("أبيض وأسود (وش وظهر)");
    setSelectedBinding({
      name: "سلك معدني وسط (حتى 120 ورقة)",
      price: pricing.wireBindingMed,
    });
    setExtraCellophane(false);
    setExtraGlue(false);
    toast.info("تم التصفير", "تمت استعادة الإعدادات الافتراضية للحاسبة");
  };

  // Save Settings
  const handleSavePricing = () => {
    setPricing(tempPricing);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tempPricing));
      toast.success("تم الحفظ", "تم تحديث جدول أسعار الورق والتجليد الافتراضية بنجاح");
    } catch {
      toast.error("خطأ", "تعذر حفظ الإعدادات");
    }
    setIsSettingsOpen(false);
  };

  return (
    <div className="flex flex-col w-full pb-space-3xl gap-space-lg text-on-surface" dir="rtl">
      {/* Top Hero Bar / Mode Switcher */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-lg shadow-xl border border-surface-container-high/40">
        <div className="absolute -left-12 -top-12 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-tertiary/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-md">
          <div className="flex items-start gap-space-md">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-highest shadow-md text-primary">
              <span className="material-symbols-outlined text-headline-md">calculate</span>
            </div>
            <div className="flex flex-col gap-space-2xs">
              <div className="flex flex-wrap items-center gap-space-xs">
                <h1 className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">
                  حاسبة المطبعة والملازم الذكية
                </h1>
                <span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-full bg-primary/15 text-primary">
                  Smart Calculator v2.4
                </span>
                <span className="font-label-tag text-label-tag px-space-xs py-space-2xs rounded-full bg-surface-container-high text-on-surface-variant">
                  تسعير لحظي
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
                حساب دقيق لورق الملازم والكتب (وش/ظهر أو وجه واحد)، أزرار تسعير فورية ومخصصة، وإضافات التجليد والسلوفان مع حاسبة عامة سريعة بنظام Numpad.
              </p>
            </div>
          </div>

          {/* Main Tabs */}
          <div className="flex items-center gap-space-xs self-start lg:self-center p-1 rounded-xl bg-surface-container-lowest border border-surface-container-high/60">
            <button
              className={`flex items-center gap-space-xs px-space-md py-space-xs rounded-lg font-headline-sm text-body-sm font-semibold transition-all ${
                activeTab === "print"
                  ? "bg-primary-container text-on-primary-container shadow-sm font-bold"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
              onClick={() => setActiveTab("print")}
              type="button"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>حاسبة الملازم والطباعة</span>
            </button>
            <button
              className={`flex items-center gap-space-xs px-space-md py-space-xs rounded-lg font-body-sm text-body-sm transition-all ${
                activeTab === "numpad"
                  ? "bg-primary-container text-on-primary-container shadow-sm font-bold"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
              onClick={() => setActiveTab("numpad")}
              type="button"
            >
              <span className="material-symbols-outlined text-base">dialpad</span>
              <span>حاسبة عامة (Numpad)</span>
            </button>
            <button
              className="p-space-xs rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              title="إعدادات التسعير الافتراضية"
              onClick={() => {
                setTempPricing(pricing);
                setIsSettingsOpen(true);
              }}
              type="button"
            >
              <span className="material-symbols-outlined text-base">settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Numpad View */}
      {activeTab === "numpad" ? (
        <div className="flex flex-col items-center justify-center pt-space-md">
          <div className="max-w-md mx-auto w-full bg-surface-container-low rounded-xl p-space-lg shadow-xl flex flex-col gap-space-md border border-surface-container-high/40">
            <div className="flex items-center justify-between">
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">آلة حاسبة سريعة</span>
              <span className="font-label-code text-label-code text-on-surface-variant">يدعم الكيبورد (Numpad)</span>
            </div>
            <div
              className="bg-surface-container-lowest p-space-md rounded-xl text-left font-label-code text-headline-lg text-primary tracking-wider overflow-x-auto min-h-[58px] flex items-center justify-end border border-surface-container-high/60 shadow-inner"
              dir="ltr"
            >
              {numpadEquation && <span className="text-on-surface-variant text-sm mr-2">{numpadEquation}</span>}
              <span>{numpadDisplay}</span>
            </div>
            <div className="grid grid-cols-4 gap-space-xs font-label-code text-body-lg" dir="ltr">
              <button
                className="p-space-sm rounded-lg bg-surface-container-high text-error hover:bg-surface-container-highest transition-colors font-bold cursor-pointer"
                onClick={() => handleNumpadAction("C")}
                type="button"
              >
                C
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container-high text-primary hover:bg-surface-container-highest transition-colors font-bold cursor-pointer"
                onClick={() => handleNumpadAction("÷")}
                type="button"
              >
                ÷
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container-high text-primary hover:bg-surface-container-highest transition-colors font-bold cursor-pointer"
                onClick={() => handleNumpadAction("×")}
                type="button"
              >
                ×
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors font-bold cursor-pointer"
                onClick={() => handleNumpadAction("DEL")}
                type="button"
              >
                ⌫
              </button>

              <button
                className="p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                onClick={() => handleNumpadNum("7")}
                type="button"
              >
                7
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                onClick={() => handleNumpadNum("8")}
                type="button"
              >
                8
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                onClick={() => handleNumpadNum("9")}
                type="button"
              >
                9
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container-high text-primary hover:bg-surface-container-highest transition-colors font-bold cursor-pointer"
                onClick={() => handleNumpadAction("-")}
                type="button"
              >
                -
              </button>

              <button
                className="p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                onClick={() => handleNumpadNum("4")}
                type="button"
              >
                4
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                onClick={() => handleNumpadNum("5")}
                type="button"
              >
                5
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                onClick={() => handleNumpadNum("6")}
                type="button"
              >
                6
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container-high text-primary hover:bg-surface-container-highest transition-colors font-bold cursor-pointer"
                onClick={() => handleNumpadAction("+")}
                type="button"
              >
                +
              </button>

              <button
                className="p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                onClick={() => handleNumpadNum("1")}
                type="button"
              >
                1
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                onClick={() => handleNumpadNum("2")}
                type="button"
              >
                2
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                onClick={() => handleNumpadNum("3")}
                type="button"
              >
                3
              </button>
              <button
                className="row-span-2 p-space-sm rounded-lg bg-primary text-on-primary font-bold hover:brightness-110 transition-all flex items-center justify-center text-headline-sm cursor-pointer shadow-md"
                onClick={handleNumpadEquals}
                type="button"
              >
                =
              </button>

              <button
                className="col-span-2 p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                onClick={() => handleNumpadNum("0")}
                type="button"
              >
                0
              </button>
              <button
                className="p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors font-semibold cursor-pointer"
                onClick={() => {
                  if (!numpadDisplay.includes(".")) handleNumpadNum(".");
                }}
                type="button"
              >
                .
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Primary Calculator Workspace (2 Columns Grid) */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
          {/* Right/Center: Setup Inputs & Modules (8 Cols on XL) */}
          <div className="xl:col-span-8 flex flex-col gap-space-lg">
            {/* Module 1: Document & Quantity Core */}
            <div className="bg-surface-container-low rounded-xl p-space-lg shadow-xl relative overflow-hidden border border-surface-container-high/40">
              <div className="flex items-center justify-between pb-space-md mb-space-md border-b-0">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-headline-sm">folder_open</span>
                  <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                    بيانات المذكرة أو المستند
                  </span>
                </div>
                <span className="font-label-tag text-label-tag px-space-xs py-space-2xs rounded bg-surface-container-high text-on-surface-variant uppercase">
                  Step 1 · الأبعاد والكميات
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                {/* Page Count */}
                <div className="flex flex-col gap-space-xs">
                  <label
                    className="flex items-center justify-between font-body-sm text-body-sm font-medium text-on-surface"
                    htmlFor="input-pages"
                  >
                    <span>عدد الصفحات في الملف (PDF / Word)</span>
                    <span className="text-on-surface-variant font-label-code text-label-code">صفحة أصلية</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      className="w-full h-11 px-space-md pr-space-md pl-12 rounded-xl bg-surface-container-lowest text-on-surface font-label-code text-body-lg text-left focus:outline-none focus:ring-2 focus:ring-primary shadow-inner border border-surface-container-high/50"
                      id="input-pages"
                      min="1"
                      onChange={(e) => setPageCount(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="120"
                      step="1"
                      type="number"
                      value={pageCount}
                    />
                    <span className="absolute left-3 text-on-surface-variant font-body-sm text-body-sm pointer-events-none">
                      صفحة
                    </span>
                  </div>
                  <span className="text-on-surface-variant font-body-sm text-body-sm">
                    مثال: كتاب مدرسي 120 صفحة أو ملزمة 45 ورقة
                  </span>
                </div>
                {/* Copies Count */}
                <div className="flex flex-col gap-space-xs">
                  <label
                    className="flex items-center justify-between font-body-sm text-body-sm font-medium text-on-surface"
                    htmlFor="input-copies"
                  >
                    <span>عدد النسخ المطلوبة (الكمية)</span>
                    <span className="text-on-surface-variant font-label-code text-label-code">نسخة للعميل</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      className="w-full h-11 px-space-md pr-space-md pl-12 rounded-xl bg-surface-container-lowest text-on-surface font-label-code text-body-lg text-left focus:outline-none focus:ring-2 focus:ring-primary shadow-inner border border-surface-container-high/50"
                      id="input-copies"
                      min="1"
                      onChange={(e) => setCopiesCount(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="50"
                      step="1"
                      type="number"
                      value={copiesCount}
                    />
                    <span className="absolute left-3 text-on-surface-variant font-body-sm text-body-sm pointer-events-none">
                      نسخة
                    </span>
                  </div>
                  <span className="text-on-surface-variant font-body-sm text-body-sm">
                    عدد الملازم أو الكتب للعميل / السنتر
                  </span>
                </div>
              </div>
              {/* Duplex / Single Selection */}
              <div className="mt-space-md flex flex-col gap-space-xs">
                <label className="font-body-sm text-body-sm font-medium text-on-surface">
                  نوع طباعة الورق (وجه واحد أم وش وظهر)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm" id="duplex-selector">
                  <button
                    className={`relative p-space-md rounded-xl flex items-center justify-between transition-all cursor-pointer border ${
                      isDuplex
                        ? "bg-primary/10 text-primary border-primary/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                        : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface border-transparent"
                    }`}
                    onClick={() => {
                      setIsDuplex(true);
                      if (paperRate === pricing.bwSingle) {
                        setPaperRate(pricing.bwDuplex);
                        setRateLabel("أبيض وأسود (وش وظهر)");
                      }
                    }}
                    type="button"
                  >
                    <div className="flex items-center gap-space-sm text-right">
                      <span className="material-symbols-outlined text-headline-sm">auto_stories</span>
                      <div>
                        <div className="font-headline-sm text-body-md font-bold">وش وظهر (Duplex)</div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant">
                          الافتراضي للملازم والكتب (يوفر 50% ورق)
                        </div>
                      </div>
                    </div>
                    <span
                      className={`material-symbols-outlined text-primary check-icon ${
                        isDuplex ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      check_circle
                    </span>
                  </button>
                  <button
                    className={`relative p-space-md rounded-xl flex items-center justify-between transition-all cursor-pointer border ${
                      !isDuplex
                        ? "bg-primary/10 text-primary border-primary/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                        : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface border-transparent"
                    }`}
                    onClick={() => {
                      setIsDuplex(false);
                      if (paperRate === pricing.bwDuplex) {
                        setPaperRate(pricing.bwSingle);
                        setRateLabel("أبيض وأسود (وجه)");
                      }
                    }}
                    type="button"
                  >
                    <div className="flex items-center gap-space-sm text-right">
                      <span className="material-symbols-outlined text-headline-sm">description</span>
                      <div>
                        <div className="font-headline-sm text-body-md font-bold">وجه واحد (Single-Sided)</div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant">
                          شيتات وامتحانات ورسم بياني ومذكرات فردية
                        </div>
                      </div>
                    </div>
                    <span
                      className={`material-symbols-outlined text-primary check-icon ${
                        !isDuplex ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      check_circle
                    </span>
                  </button>
                </div>
              </div>
              {/* Dynamic Live Summary Pill Banner */}
              <div className="mt-space-md p-space-sm rounded-xl bg-surface-container flex flex-wrap items-center justify-between gap-space-sm border border-surface-container-high/50">
                <div className="flex items-center gap-space-xs text-on-surface font-body-sm text-body-sm">
                  <span className="material-symbols-outlined text-primary text-base">insights</span>
                  <span className="text-on-surface-variant">النتيجة الحسابية:</span>
                  <span className="font-label-code text-label-code font-bold text-primary" id="banner-pages-calc">
                    {pageCount} صفحة {isDuplex ? "وش وظهر" : "وجه واحد"} = {sheetCountPerCopy} ورقة لكل نسخة
                  </span>
                </div>
                <div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-lg bg-surface-container-lowest border border-surface-container-high/40">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">إجمالي الأوردر:</span>
                  <span className="font-label-code text-label-code font-bold text-tertiary" id="banner-total-sheets">
                    {totalSheetsOrder.toLocaleString("ar-EG")} ورقة ({packetsA4Count} باكيت A4)
                  </span>
                </div>
              </div>
            </div>

            {/* Module 2: Paper & Print Price Presets */}
            <div className="bg-surface-container-low rounded-xl p-space-lg shadow-xl flex flex-col gap-space-md border border-surface-container-high/40">
              <div className="flex flex-wrap items-center justify-between gap-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-headline-sm">sell</span>
                  <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                    أزرار تسعير الورقة والطباعة السريعة
                  </span>
                </div>
                <div className="flex items-center gap-space-xs font-label-code text-label-code text-on-surface-variant">
                  <span>المحدد حالياً:</span>
                  <span className="px-space-xs py-space-2xs rounded bg-primary/15 text-primary font-semibold">
                    {rateLabel} {paperRate.toFixed(2)} ج.م
                  </span>
                </div>
              </div>

              {/* 6 Quick Presets Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-space-sm" id="preset-grid">
                {/* Preset 1 */}
                <button
                  className={`p-space-sm rounded-xl text-right flex flex-col justify-between h-20 transition-all cursor-pointer border ${
                    paperRate === pricing.bwSingle
                      ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                      : "bg-surface-container hover:bg-surface-container-high border-transparent text-on-surface"
                  }`}
                  onClick={() => handlePresetSelect(pricing.bwSingle, "أبيض وأسود (وجه)")}
                  type="button"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-body-sm text-body-sm font-semibold">أبيض وأسود (وجه)</span>
                    <span className="w-2 h-2 rounded-full bg-on-surface-variant"></span>
                  </div>
                  <div className="font-label-code text-headline-sm font-bold">
                    {pricing.bwSingle.toFixed(2)}{" "}
                    <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">ج.م</span>
                  </div>
                </button>

                {/* Preset 2 */}
                <button
                  className={`p-space-sm rounded-xl text-right flex flex-col justify-between h-20 transition-all cursor-pointer border ${
                    paperRate === pricing.bwDuplex
                      ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                      : "bg-surface-container hover:bg-surface-container-high border-transparent text-on-surface"
                  }`}
                  onClick={() => handlePresetSelect(pricing.bwDuplex, "أبيض وأسود (وش وظهر)")}
                  type="button"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-body-sm text-body-sm font-semibold">أبيض وأسود (وش وظهر)</span>
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  </div>
                  <div className="font-label-code text-headline-sm font-bold">
                    {pricing.bwDuplex.toFixed(2)}{" "}
                    <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">ج.م</span>
                  </div>
                </button>

                {/* Preset 3 */}
                <button
                  className={`p-space-sm rounded-xl text-right flex flex-col justify-between h-20 transition-all cursor-pointer border ${
                    paperRate === (isDuplex ? pricing.colorLightDuplex : pricing.colorLightSingle)
                      ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                      : "bg-surface-container hover:bg-surface-container-high border-transparent text-on-surface"
                  }`}
                  onClick={() =>
                    handlePresetSelect(
                      isDuplex ? pricing.colorLightDuplex : pricing.colorLightSingle,
                      "ألوان خفيف / هيدر"
                    )
                  }
                  type="button"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-body-sm text-body-sm font-semibold">ألوان خفيف / هيدر</span>
                    <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                  </div>
                  <div className="font-label-code text-headline-sm font-bold">
                    {(isDuplex ? pricing.colorLightDuplex : pricing.colorLightSingle).toFixed(2)}{" "}
                    <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">ج.م</span>
                  </div>
                </button>

                {/* Preset 4 */}
                <button
                  className={`p-space-sm rounded-xl text-right flex flex-col justify-between h-20 transition-all cursor-pointer border ${
                    paperRate === (isDuplex ? pricing.colorMediumDuplex : pricing.colorMediumSingle)
                      ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                      : "bg-surface-container hover:bg-surface-container-high border-transparent text-on-surface"
                  }`}
                  onClick={() =>
                    handlePresetSelect(
                      isDuplex ? pricing.colorMediumDuplex : pricing.colorMediumSingle,
                      "ألوان متوسط (ملازم)"
                    )
                  }
                  type="button"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-body-sm text-body-sm font-semibold">ألوان متوسط (ملازم)</span>
                    <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                  </div>
                  <div className="font-label-code text-headline-sm font-bold">
                    {(isDuplex ? pricing.colorMediumDuplex : pricing.colorMediumSingle).toFixed(2)}{" "}
                    <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">ج.م</span>
                  </div>
                </button>

                {/* Preset 5 */}
                <button
                  className={`p-space-sm rounded-xl text-right flex flex-col justify-between h-20 transition-all cursor-pointer border ${
                    paperRate === (isDuplex ? pricing.colorHeavyDuplex : pricing.colorHeavySingle)
                      ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                      : "bg-surface-container hover:bg-surface-container-high border-transparent text-on-surface"
                  }`}
                  onClick={() =>
                    handlePresetSelect(
                      isDuplex ? pricing.colorHeavyDuplex : pricing.colorHeavySingle,
                      "ألوان ثقيل / تغطية"
                    )
                  }
                  type="button"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-body-sm text-body-sm font-semibold">ألوان ثقيل / تغطية</span>
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  </div>
                  <div className="font-label-code text-headline-sm font-bold">
                    {(isDuplex ? pricing.colorHeavyDuplex : pricing.colorHeavySingle).toFixed(2)}{" "}
                    <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">ج.م</span>
                  </div>
                </button>

                {/* Preset 6 */}
                <button
                  className={`p-space-sm rounded-xl text-right flex flex-col justify-between h-20 transition-all cursor-pointer border ${
                    paperRate === pricing.glossy
                      ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                      : "bg-surface-container hover:bg-surface-container-high border-transparent text-on-surface"
                  }`}
                  onClick={() => handlePresetSelect(pricing.glossy, "كوشيه / جلوسي")}
                  type="button"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-body-sm text-body-sm font-semibold">كوشيه / جلوسي</span>
                    <span className="w-2 h-2 rounded-full bg-primary-container"></span>
                  </div>
                  <div className="font-label-code text-headline-sm font-bold">
                    {pricing.glossy.toFixed(2)}{" "}
                    <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">ج.م</span>
                  </div>
                </button>
              </div>

              {/* Custom Price Inline Input */}
              <div className="flex items-center justify-between p-space-sm rounded-xl bg-surface-container-lowest gap-space-md border border-surface-container-high/40">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-on-surface-variant text-lg">tune</span>
                  <span className="font-body-sm text-body-sm text-on-surface">أو تحديد سعر ورقة يدوي مخصص:</span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <input
                    className="w-24 h-9 px-space-xs rounded-lg bg-surface-container text-primary font-label-code text-body-md text-center focus:outline-none focus:ring-2 focus:ring-primary shadow-inner border border-surface-container-high"
                    min="0.1"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setPaperRate(val);
                      setRateLabel("سعر مخصص");
                    }}
                    step="0.05"
                    type="number"
                    value={paperRate}
                  />
                  <span className="font-body-sm text-body-sm text-on-surface-variant">ج.م للورقة</span>
                </div>
              </div>
            </div>

            {/* Module 3: Binding & Add-ons Finishes */}
            <div className="bg-surface-container-low rounded-xl p-space-lg shadow-xl flex flex-col gap-space-md border border-surface-container-high/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-headline-sm">book_online</span>
                  <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                    خدمات التجليد والتشطيب (Add-ons)
                  </h2>
                </div>
                <span className="font-label-tag text-label-tag px-space-xs py-space-2xs rounded bg-surface-container-high text-on-surface-variant">
                  سعر مضاف للنسخة
                </span>
              </div>

              {/* Spiral Wire Binding Options */}
              <div className="flex flex-col gap-space-sm">
                <span className="font-body-sm text-body-sm font-medium text-on-surface-variant">
                  تجليد السلك المعدني (Spiral Wire Binding):
                </span>
                <div className="grid grid-cols-3 gap-space-sm">
                  {[
                    { name: "سلك معدني صغير (حتى 60 ورقة)", label: "سلك صغير (حتى 60 ورقة)", price: pricing.wireBindingSmall },
                    { name: "سلك معدني وسط (حتى 120 ورقة)", label: "سلك وسط (حتى 120 ورقة)", price: pricing.wireBindingMed },
                    { name: "سلك معدني كبير (حتى 250 ورقة)", label: "سلك كبير (حتى 250 ورقة)", price: pricing.wireBindingLarge },
                  ].map((item) => {
                    const isSelected = selectedBinding?.name === item.name;
                    return (
                      <button
                        key={item.name}
                        className={`p-space-sm rounded-xl text-right flex flex-col justify-between transition-all cursor-pointer border ${
                          isSelected
                            ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                            : "bg-surface-container hover:bg-surface-container-high border-transparent text-on-surface"
                        }`}
                        onClick={() => setSelectedBinding(isSelected ? null : { name: item.name, price: item.price })}
                        type="button"
                      >
                        <span className="font-body-sm text-body-sm">{item.label}</span>
                        <span className="font-label-code text-headline-sm mt-space-2xs font-bold">
                          {item.price}{" "}
                          <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">ج.م</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Plastic Comb Binding Options */}
              <div className="flex flex-col gap-space-sm mt-space-xs">
                <span className="font-body-sm text-body-sm font-medium text-on-surface-variant">
                  تجليد المشط البلاستيكي (Plastic Comb):
                </span>
                <div className="grid grid-cols-3 gap-space-sm">
                  {[
                    { name: "تجليد بلاستيك صغير", label: "بلاستيك صغير", price: pricing.plasticBindingSmall },
                    { name: "تجليد بلاستيك وسط", label: "بلاستيك وسط", price: pricing.plasticBindingMed },
                    { name: "تجليد بلاستيك كبير", label: "بلاستيك كبير", price: pricing.plasticBindingLarge },
                  ].map((item) => {
                    const isSelected = selectedBinding?.name === item.name;
                    return (
                      <button
                        key={item.name}
                        className={`p-space-sm rounded-xl text-right flex flex-col justify-between transition-all cursor-pointer border ${
                          isSelected
                            ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                            : "bg-surface-container hover:bg-surface-container-high border-transparent text-on-surface"
                        }`}
                        onClick={() => setSelectedBinding(isSelected ? null : { name: item.name, price: item.price })}
                        type="button"
                      >
                        <span className="font-body-sm text-body-sm">{item.label}</span>
                        <span className="font-label-code text-headline-sm mt-space-2xs font-bold">
                          {item.price}{" "}
                          <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">ج.م</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Extras: Cellophane, Glue, Clear */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm pt-space-xs">
                <button
                  className={`p-space-sm rounded-xl flex items-center justify-between text-right transition-all cursor-pointer border ${
                    extraCellophane
                      ? "bg-primary/10 border-primary/40 text-primary shadow-sm"
                      : "bg-surface-container hover:bg-surface-container-high border-transparent text-on-surface"
                  }`}
                  onClick={() => setExtraCellophane(!extraCellophane)}
                  type="button"
                >
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-primary">
                      {extraCellophane ? "check_box" : "check_box_outline_blank"}
                    </span>
                    <span className="font-body-sm text-body-sm">سلوفان حراري مط/لامع</span>
                  </div>
                  <span className="font-label-code text-body-sm text-tertiary font-bold">
                    +{pricing.cellophane} ج.م
                  </span>
                </button>

                <button
                  className={`p-space-sm rounded-xl flex items-center justify-between text-right transition-all cursor-pointer border ${
                    extraGlue
                      ? "bg-primary/10 border-primary/40 text-primary shadow-sm"
                      : "bg-surface-container hover:bg-surface-container-high border-transparent text-on-surface"
                  }`}
                  onClick={() => setExtraGlue(!extraGlue)}
                  type="button"
                >
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-primary">
                      {extraGlue ? "check_box" : "check_box_outline_blank"}
                    </span>
                    <span className="font-body-sm text-body-sm">كعب حراري غراء فوري</span>
                  </div>
                  <span className="font-label-code text-body-sm text-tertiary font-bold">
                    +{pricing.glue} ج.م
                  </span>
                </button>

                <button
                  className="p-space-sm rounded-xl bg-surface-container-highest hover:bg-surface-container-high text-on-surface-variant hover:text-error flex items-center justify-center gap-space-2xs transition-colors cursor-pointer border border-surface-container-high"
                  onClick={() => {
                    setSelectedBinding(null);
                    setExtraCellophane(false);
                    setExtraGlue(false);
                  }}
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                  <span className="font-body-sm text-body-sm">بدون تجليد (ورق فرط)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Left Column: Live Estimation Sticky Invoice Card (4 Cols on XL) */}
          <div className="xl:col-span-4 sticky top-20 flex flex-col gap-space-md">
            <div className="bg-surface-container-low rounded-xl p-space-lg shadow-2xl relative overflow-hidden flex flex-col gap-space-md border border-surface-container-high/50">
              {/* Glow top edge */}
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary via-primary-container to-tertiary"></div>

              {/* Invoice Header */}
              <div className="flex items-center justify-between pb-space-sm border-b-0">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-headline-sm">receipt_long</span>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    ملخص الفاتورة التقديرية
                  </h3>
                </div>
                <div className="flex items-center gap-space-2xs">
                  <button
                    className="p-space-2xs rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                    onClick={handleCopyInvoice}
                    title="نسخ الفاتورة نصياً"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg">content_copy</span>
                  </button>
                  <button
                    className="p-space-2xs rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                    onClick={handleCopyInvoice}
                    title="مشاركة الفاتورة"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg">share</span>
                  </button>
                </div>
              </div>

              {/* Metric Rows */}
              <div className="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface divide-y-0">
                <div className="flex items-center justify-between py-1">
                  <span className="text-on-surface-variant">عدد الصفحات الأصلية:</span>
                  <span className="font-label-code text-label-code font-bold text-on-surface">
                    {pageCount} صفحة
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-on-surface-variant">نوع الطباعة:</span>
                  <span className="font-label-code text-label-code text-primary font-bold">
                    {isDuplex ? "وش وظهر (Duplex)" : "وجه واحد (Single)"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-on-surface-variant">الورق الفعلي لكل نسخة:</span>
                  <span className="font-label-code text-label-code font-bold text-on-surface">
                    {sheetCountPerCopy} ورقة
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-on-surface-variant">عدد النسخ المطلوبة:</span>
                  <span className="font-label-code text-label-code font-bold text-on-surface">
                    {copiesCount} نسخة
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-on-surface-variant">إجمالي الورق المستخدم:</span>
                  <span className="font-label-code text-label-code font-bold text-tertiary">
                    {totalSheetsOrder.toLocaleString("ar-EG")} ورقة (A4)
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-on-surface-variant">سعر الورقة المختارة:</span>
                  <span className="font-label-code text-label-code text-on-surface">
                    {paperRate.toFixed(2)} ج.م
                  </span>
                </div>

                <div className="my-space-xs h-px bg-surface-container-highest"></div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-on-surface-variant">تكلفة الطباعة للنسخة:</span>
                  <span className="font-label-code text-label-code text-on-surface">
                    {printCostPerCopy.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-on-surface-variant">تكلفة التجليد والتشطيب:</span>
                  <span className="font-label-code text-label-code text-on-surface">
                    {bindingCostPerCopy.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 font-semibold">
                  <span className="text-on-surface">إجمالي تكلفة النسخة الواحدة:</span>
                  <span className="font-label-code text-body-md text-primary">
                    {singleCopyTotalCost.toFixed(2)} ج.م
                  </span>
                </div>
              </div>

              {/* Big Highlight Grand Total Box */}
              <div className="p-space-md rounded-xl bg-surface-container-lowest flex flex-col items-center justify-center gap-space-2xs text-center shadow-inner relative overflow-hidden border border-surface-container-high/40">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none"></div>
                <span className="font-label-tag text-label-tag text-on-surface-variant uppercase tracking-wider">
                  الإجمالي النهائي المطلوب
                </span>
                <div className="flex items-baseline gap-space-2xs">
                  <span className="font-label-code text-display-hero font-extrabold text-primary tracking-tight">
                    {grandTotalCost.toLocaleString("ar-EG")}
                  </span>
                  <span className="font-headline-sm text-headline-sm text-primary">ج.م</span>
                </div>
                <div className="flex items-center gap-space-xs mt-1">
                  <span className="font-label-code text-label-code px-space-xs py-space-2xs rounded bg-surface-container text-on-surface-variant">
                    تكلفة الإنتاج: ~{estProductionCost.toLocaleString("ar-EG")} ج.م
                  </span>
                  <span className="font-label-code text-label-code px-space-xs py-space-2xs rounded bg-primary-container/20 text-primary font-bold">
                    هامش الربح: ~{profitMarginPercent}%
                  </span>
                </div>
              </div>

              {/* Fast Actions & Workflow Buttons */}
              <div className="flex flex-col gap-space-sm pt-space-xs">
                <button
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary font-headline-sm text-body-md font-bold flex items-center justify-center gap-space-xs shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all transform active:scale-95 cursor-pointer"
                  onClick={handleTransferToShiftOrder}
                  type="button"
                >
                  <span className="material-symbols-outlined text-xl">assignment_turned_in</span>
                  <span>تحويل إلى أوردر في الشفت فوراً</span>
                </button>
                <button
                  className="w-full h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-sm text-body-sm font-semibold flex items-center justify-center gap-space-xs transition-all cursor-pointer border border-surface-container-highest"
                  onClick={handleSendWhatsappQuote}
                  type="button"
                >
                  <span className="material-symbols-outlined text-lg text-primary">send_to_mobile</span>
                  <span>إرسال عرض السعر للعميل عبر واتساب</span>
                </button>
                <button
                  className="w-full py-space-xs rounded-lg text-on-surface-variant hover:text-error text-body-sm font-body-sm flex items-center justify-center gap-space-2xs transition-colors cursor-pointer"
                  onClick={handleReset}
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                  <span>تصفير الحسابات والبدء من جديد</span>
                </button>
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="p-space-md rounded-xl bg-surface-container-low flex items-start gap-space-sm border border-surface-container-high/40">
              <span className="material-symbols-outlined text-tertiary text-xl shrink-0 mt-0.5">
                tips_and_updates
              </span>
              <div className="flex flex-col gap-space-2xs">
                <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                  ملاحظة تسعير الملازم:
                </span>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  الطباعة 'وش وظهر' تحسب سعر الورقة كاملة متضمنة وجهي الطباعة. إذا كانت المذكرة فردية الصفحات (مثلاً 121 صفحة)، تُجبر آخر ورقة تلقائياً لضمان حساب التكلفة الصحيح.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal Dialog */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface-container-low border border-surface-container-high rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">settings</span>
                <h3 className="font-bold text-lg text-on-surface">إعدادات أسعار الطباعة والتجليد الافتراضية</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <span className="font-bold text-primary block">أسعار الورق والطباعة (ج.م للورقة):</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">أبيض وأسود (وجه):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={tempPricing.bwSingle}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, bwSingle: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface border border-surface-container-high"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">أبيض وأسود (وش وظهر):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={tempPricing.bwDuplex}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, bwDuplex: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface border border-surface-container-high"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">ألوان خفيف (وش وظهر):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={tempPricing.colorLightDuplex}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, colorLightDuplex: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface border border-surface-container-high"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">ألوان ملازم (وش وظهر):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={tempPricing.colorMediumDuplex}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, colorMediumDuplex: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface border border-surface-container-high"
                  />
                </div>
              </div>

              <span className="font-bold text-primary block pt-2">أسعار التجليد (ج.م للنسخة):</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">سلك صغير:</label>
                  <input
                    type="number"
                    value={tempPricing.wireBindingSmall}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, wireBindingSmall: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface border border-surface-container-high"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">سلك وسط:</label>
                  <input
                    type="number"
                    value={tempPricing.wireBindingMed}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, wireBindingMed: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface border border-surface-container-high"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">سلوفان حراري:</label>
                  <input
                    type="number"
                    value={tempPricing.cellophane}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, cellophane: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface border border-surface-container-high"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1">كعب غراء حراري:</label>
                  <input
                    type="number"
                    value={tempPricing.glue}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, glue: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface border border-surface-container-high"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-container text-on-surface-variant hover:bg-surface-container-high text-sm font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSavePricing}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-md"
              >
                حفظ الأسعار
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
