"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/components/toast-provider";
import { SITE_CONFIG } from "@/lib/site-config";

export interface QuickPricingButton {
  id: string;
  label: string;
  price: number;
  colorDot?: string;
}

const DEFAULT_QUICK_BUTTONS: QuickPricingButton[] = [
  { id: "bw-single", label: "أبيض وأسود (وجه)", price: 0.8, colorDot: "bg-slate-400" },
  { id: "bw-duplex", label: "أبيض وأسود (وش وظهر)", price: 0.9, colorDot: "bg-cyan-400 animate-pulse" },
  { id: "color-light", label: "ألوان خفيف / هيدر", price: 1.25, colorDot: "bg-amber-400" },
  { id: "color-med", label: "ألوان متوسط (ملازم)", price: 1.5, colorDot: "bg-blue-400" },
  { id: "color-heavy", label: "ألوان ثقيل / تغطية", price: 2.5, colorDot: "bg-pink-400" },
  { id: "glossy", label: "كوشيه / جلوسي", price: 10.0, colorDot: "bg-emerald-400" },
];

const BUTTONS_STORAGE_KEY = "copycat_custom_pricing_buttons_v1";

export interface CustomAddon {
  id: string;
  category: "wire" | "plastic" | "finishing";
  name: string;
  label: string;
  price: number;
}

const DEFAULT_ADDONS: CustomAddon[] = [
  { id: "wire-small", category: "wire", name: "سلك معدني صغير (حتى 60 ورقة)", label: "سلك صغير (حتى 60 ورقة)", price: 15 },
  { id: "wire-med", category: "wire", name: "سلك معدني وسط (حتى 120 ورقة)", label: "سلك وسط (حتى 120 ورقة)", price: 20 },
  { id: "wire-large", category: "wire", name: "سلك معدني كبير (حتى 250 ورقة)", label: "سلك كبير (حتى 250 ورقة)", price: 25 },
  { id: "plastic-small", category: "plastic", name: "تجليد بلاستيك صغير", label: "بلاستيك صغير", price: 10 },
  { id: "plastic-med", category: "plastic", name: "تجليد بلاستيك وسط", label: "بلاستيك وسط", price: 15 },
  { id: "plastic-large", category: "plastic", name: "تجليد بلاستيك كبير", label: "بلاستيك كبير", price: 20 },
  { id: "finish-cellophane", category: "finishing", name: "سلوفان حراري مط/لامع", label: "سلوفان حراري مط/لامع", price: 5 },
  { id: "finish-glue", category: "finishing", name: "كعب غراء حراري", label: "كعب غراء حراري", price: 12 },
];

const ADDONS_STORAGE_KEY = "copycat_custom_addons_v1";

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

  // Dynamic quick buttons state
  const [quickButtons, setQuickButtons] = useState<QuickPricingButton[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(BUTTONS_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return DEFAULT_QUICK_BUTTONS;
  });

  const [isManageButtonsOpen, setIsManageButtonsOpen] = useState(false);
  const [newBtnLabel, setNewBtnLabel] = useState("");
  const [newBtnPrice, setNewBtnPrice] = useState("");
  const [editingBtnId, setEditingBtnId] = useState<string | null>(null);
  const [editBtnLabel, setEditBtnLabel] = useState("");
  const [editBtnPrice, setEditBtnPrice] = useState("");

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

  // Core Job Inputs - Default to 0 as requested
  const [pageCount, setPageCount] = useState<number>(0);
  const [copiesCount, setCopiesCount] = useState<number>(0);
  const [isDuplex, setIsDuplex] = useState<boolean>(true);
  const [paperRate, setPaperRate] = useState<number>(0.9);
  const [rateLabel, setRateLabel] = useState<string>("أبيض وأسود (وش وظهر)");

  // Binding selections - Default to null
  const [selectedBinding, setSelectedBinding] = useState<{ name: string; price: number } | null>(null);

  // Dynamic custom add-ons state
  const [customAddons, setCustomAddons] = useState<CustomAddon[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(ADDONS_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return DEFAULT_ADDONS;
  });

  const [isManageAddonsOpen, setIsManageAddonsOpen] = useState(false);
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");
  const [newAddonCategory, setNewAddonCategory] = useState<"wire" | "plastic" | "finishing">("wire");
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [editAddonName, setEditAddonName] = useState("");
  const [editAddonPrice, setEditAddonPrice] = useState("");
  const [editAddonCategory, setEditAddonCategory] = useState<"wire" | "plastic" | "finishing">("wire");

  // Selected finishing add-ons IDs (e.g. cellophane, glue, etc.)
  const [selectedFinishingIds, setSelectedFinishingIds] = useState<string[]>([]);

  const toggleFinishing = (id: string) => {
    setSelectedFinishingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

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
    customAddons
      .filter((a) => a.category === "finishing" && selectedFinishingIds.includes(a.id))
      .forEach((a) => {
        cost += a.price;
      });
    return cost;
  }, [selectedBinding, customAddons, selectedFinishingIds]);

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
    customAddons
      .filter((a) => a.category === "finishing" && selectedFinishingIds.includes(a.id))
      .forEach((a) => {
        text += `• إضافة ${a.name}: +${a.price} ج.م\n`;
      });
    text += `• إجمالي سعر النسخة الواحدة: ${singleCopyTotalCost.toFixed(2)} ج.م\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 *الإجمالي النهائي المطلوب: ${grandTotalCost.toLocaleString("ar-EG")} ج.م*\n`;
    text += `📍 ${SITE_CONFIG.store.address} | هاتف: ${SITE_CONFIG.store.phone}\n`;

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
    customAddons
      .filter((a) => a.category === "finishing" && selectedFinishingIds.includes(a.id))
      .forEach((a) => {
        msg += `✨ إضافة ${a.name}: +${a.price} ج.م\n`;
      });
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
      const activeFinishingNames = customAddons
        .filter((a) => a.category === "finishing" && selectedFinishingIds.includes(a.id))
        .map((a) => a.name)
        .join(" + ");
      const newTask = {
        id: orderId,
        title: `ملزمة/مستند (${pageCount} ص - ${isDuplex ? "وش وظهر" : "وجه واحد"}) ${selectedBinding ? "+ " + selectedBinding.name : ""} ${activeFinishingNames ? "+ " + activeFinishingNames : ""}`,
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

  // Reset Calculator - Zeroes out all page and copy numbers
  const handleReset = () => {
    setPageCount(0);
    setCopiesCount(0);
    setIsDuplex(true);
    setPaperRate(pricing.bwDuplex);
    setRateLabel("أبيض وأسود (وش وظهر)");
    setSelectedBinding(null);
    setSelectedFinishingIds([]);
    toast.info("تم التصفير", "تم تصفير جميع القيم والبدء من جديد (0 صفحة / 0 نسخة)");
  };

  // Custom Add-ons Management Handlers
  const handleAddAddon = () => {
    if (!newAddonName.trim() || isNaN(parseFloat(newAddonPrice)) || parseFloat(newAddonPrice) <= 0) {
      toast.warning("بيانات غير مكتملة", "يرجى كتابة اسم الخدمة وسعرها بصيغة صحيحة");
      return;
    }
    const newAddon: CustomAddon = {
      id: `addon-${Date.now()}`,
      category: newAddonCategory,
      name: newAddonName.trim(),
      label: newAddonName.trim(),
      price: parseFloat(newAddonPrice),
    };
    const updated = [...customAddons, newAddon];
    setCustomAddons(updated);
    try {
      localStorage.setItem(ADDONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setNewAddonName("");
    setNewAddonPrice("");
    toast.success("تمت الإضافة", `تمت إضافة خدمة التجليد "${newAddon.name}" بنجاح`);
  };

  const handleSaveEditAddon = (id: string) => {
    if (!editAddonName.trim() || isNaN(parseFloat(editAddonPrice)) || parseFloat(editAddonPrice) <= 0) {
      toast.warning("بيانات غير مكتملة", "يرجى التحقق من الاسم والسعر");
      return;
    }
    const updated = customAddons.map((a) =>
      a.id === id
        ? {
            ...a,
            name: editAddonName.trim(),
            label: editAddonName.trim(),
            category: editAddonCategory,
            price: parseFloat(editAddonPrice),
          }
        : a
    );
    setCustomAddons(updated);
    try {
      localStorage.setItem(ADDONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setEditingAddonId(null);
    toast.success("تم التعديل", "تم حفظ تعديل خدمة التجليد بنجاح");
  };

  const handleDeleteAddon = (id: string) => {
    if (customAddons.length <= 1) {
      toast.warning("تنبيه", "يجب الإبقاء على خدمة تجليد واحدة على الأقل");
      return;
    }
    const updated = customAddons.filter((a) => a.id !== id);
    setCustomAddons(updated);
    try {
      localStorage.setItem(ADDONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    if (selectedBinding && !updated.some((a) => a.name === selectedBinding.name)) {
      setSelectedBinding(null);
    }
    setSelectedFinishingIds((prev) => prev.filter((x) => x !== id));
    toast.info("تم الحذف", "تم حذف خدمة التجليد");
  };

  const handleResetAddons = () => {
    setCustomAddons(DEFAULT_ADDONS);
    try {
      localStorage.setItem(ADDONS_STORAGE_KEY, JSON.stringify(DEFAULT_ADDONS));
    } catch {}
    toast.success("تم الاسترجاع", "تمت استعادة خدمات التجليد والتشطيب الافتراضية");
  };

  // Custom Quick Buttons Management
  const handleAddButton = () => {
    if (!newBtnLabel.trim() || isNaN(parseFloat(newBtnPrice)) || parseFloat(newBtnPrice) <= 0) {
      toast.warning("بيانات غير مكتملة", "يرجى كتابة اسم الزر وسعر الورقة بصيغة صحيحة");
      return;
    }
    const newBtn: QuickPricingButton = {
      id: `btn-${Date.now()}`,
      label: newBtnLabel.trim(),
      price: parseFloat(newBtnPrice),
      colorDot: "bg-primary",
    };
    const updated = [...quickButtons, newBtn];
    setQuickButtons(updated);
    try {
      localStorage.setItem(BUTTONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setNewBtnLabel("");
    setNewBtnPrice("");
    toast.success("تمت الإضافة", `تمت إضافة زر التسعير "${newBtn.label}" بنجاح`);
  };

  const handleSaveEditButton = (id: string) => {
    if (!editBtnLabel.trim() || isNaN(parseFloat(editBtnPrice)) || parseFloat(editBtnPrice) <= 0) {
      toast.warning("بيانات غير مكتملة", "يرجى التحقق من الاسم والسعر");
      return;
    }
    const updated = quickButtons.map((b) =>
      b.id === id ? { ...b, label: editBtnLabel.trim(), price: parseFloat(editBtnPrice) } : b
    );
    setQuickButtons(updated);
    try {
      localStorage.setItem(BUTTONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setEditingBtnId(null);
    toast.success("تم التعديل", "تم حفظ تعديل زر التسعير");
  };

  const handleDeleteButton = (id: string) => {
    if (quickButtons.length <= 1) {
      toast.warning("تنبيه", "يجب الإبقاء على زر تسعير واحد على الأقل");
      return;
    }
    const updated = quickButtons.filter((b) => b.id !== id);
    setQuickButtons(updated);
    try {
      localStorage.setItem(BUTTONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    toast.info("تم الحذف", "تم حذف زر التسعير");
  };

  const handleResetButtons = () => {
    setQuickButtons(DEFAULT_QUICK_BUTTONS);
    try {
      localStorage.setItem(BUTTONS_STORAGE_KEY, JSON.stringify(DEFAULT_QUICK_BUTTONS));
    } catch {}
    toast.success("تم الاسترجاع", "تمت استعادة أزرار التسعير الافتراضية");
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
    <div className="flex flex-col w-full pb-12 gap-6 text-slate-900" dir="rtl">
      {/* Top Hero Bar / Mode Switcher */}
      <div className="rounded-2xl bg-white p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <span className="material-symbols-outlined text-2xl">calculate</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  حاسبة المطبعة والملازم الذكية
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Smart Calculator v2.4
                </span>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  تسعير لحظي
                </span>
              </div>
              <p className="text-sm text-slate-500 max-w-3xl">
                حساب دقيق لورق الملازم والكتب (وش/ظهر أو وجه واحد)، أزرار تسعير فورية ومخصصة، وإضافات التجليد والسلوفان مع حاسبة عامة سريعة بنظام Numpad.
              </p>
            </div>
          </div>

          {/* Main Tabs */}
          <div className="flex items-center gap-1.5 self-start lg:self-center p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "print"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
              onClick={() => setActiveTab("print")}
              type="button"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>حاسبة الملازم والطباعة</span>
            </button>
            <button
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === "numpad"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
              onClick={() => setActiveTab("numpad")}
              type="button"
            >
              <span className="material-symbols-outlined text-base">dialpad</span>
              <span>حاسبة عامة (Numpad)</span>
            </button>
            <button
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
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
        <div className="flex flex-col items-center justify-center pt-4">
          <div className="max-w-md mx-auto w-full bg-white rounded-2xl p-6 shadow-xs flex flex-col gap-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-900">آلة حاسبة سريعة</span>
              <span className="text-xs text-slate-500 font-medium">يدعم الكيبورد (Numpad)</span>
            </div>
            <div
              className="bg-slate-50 p-4 rounded-xl text-left font-mono text-2xl text-blue-600 font-bold tracking-wider overflow-x-auto min-h-[58px] flex items-center justify-end border border-slate-200"
              dir="ltr"
            >
              {numpadEquation && <span className="text-slate-400 text-sm mr-2">{numpadEquation}</span>}
              <span>{numpadDisplay}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 font-mono text-lg" dir="ltr">
              <button
                className="p-3 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors font-bold cursor-pointer border border-rose-100"
                onClick={() => handleNumpadAction("C")}
                type="button"
              >
                C
              </button>
              <button
                className="p-3 rounded-xl bg-slate-100 text-blue-600 hover:bg-blue-50 transition-colors font-bold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadAction("÷")}
                type="button"
              >
                ÷
              </button>
              <button
                className="p-3 rounded-xl bg-slate-100 text-blue-600 hover:bg-blue-50 transition-colors font-bold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadAction("×")}
                type="button"
              >
                ×
              </button>
              <button
                className="p-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors font-bold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadAction("DEL")}
                type="button"
              >
                ⌫
              </button>

              <button
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors font-semibold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadNum("7")}
                type="button"
              >
                7
              </button>
              <button
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors font-semibold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadNum("8")}
                type="button"
              >
                8
              </button>
              <button
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors font-semibold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadNum("9")}
                type="button"
              >
                9
              </button>
              <button
                className="p-3 rounded-xl bg-slate-100 text-blue-600 hover:bg-blue-50 transition-colors font-bold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadAction("-")}
                type="button"
              >
                -
              </button>

              <button
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors font-semibold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadNum("4")}
                type="button"
              >
                4
              </button>
              <button
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors font-semibold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadNum("5")}
                type="button"
              >
                5
              </button>
              <button
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors font-semibold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadNum("6")}
                type="button"
              >
                6
              </button>
              <button
                className="p-3 rounded-xl bg-slate-100 text-blue-600 hover:bg-blue-50 transition-colors font-bold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadAction("+")}
                type="button"
              >
                +
              </button>

              <button
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors font-semibold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadNum("1")}
                type="button"
              >
                1
              </button>
              <button
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors font-semibold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadNum("2")}
                type="button"
              >
                2
              </button>
              <button
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors font-semibold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadNum("3")}
                type="button"
              >
                3
              </button>
              <button
                className="row-span-2 p-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all flex items-center justify-center text-xl cursor-pointer shadow-xs"
                onClick={handleNumpadEquals}
                type="button"
              >
                =
              </button>

              <button
                className="col-span-2 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors font-semibold cursor-pointer border border-slate-200"
                onClick={() => handleNumpadNum("0")}
                type="button"
              >
                0
              </button>
              <button
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors font-semibold cursor-pointer border border-slate-200"
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
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Right/Center: Setup Inputs & Modules (8 Cols on XL) */}
          <div className="xl:col-span-8 flex flex-col gap-6">
            {/* Module 1: Document & Quantity Core */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-2xl">folder_open</span>
                  <span className="text-base font-bold text-slate-900">
                    بيانات المذكرة أو المستند
                  </span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 uppercase">
                  Step 1 · الأبعاد والكميات
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Page Count */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="flex items-center justify-between text-xs font-bold text-slate-700"
                    htmlFor="input-pages"
                  >
                    <span>عدد الصفحات في الملف (PDF / Word)</span>
                    <span className="text-slate-500 font-mono">صفحة أصلية</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      className="w-full h-11 px-4 pr-4 pl-12 rounded-xl bg-slate-50 text-slate-900 font-mono text-base text-left focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 border border-slate-200 transition"
                      id="input-pages"
                      min="0"
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                        setPageCount(isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      placeholder="0"
                      step="1"
                      type="number"
                      value={pageCount === 0 ? "" : pageCount}
                    />
                    <span className="absolute left-3 text-slate-400 text-xs pointer-events-none">
                      صفحة
                    </span>
                  </div>
                  <span className="text-slate-500 text-xs">
                    مثال: كتاب مدرسي 120 صفحة أو ملزمة 45 ورقة
                  </span>
                </div>
                {/* Copies Count */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="flex items-center justify-between text-xs font-bold text-slate-700"
                    htmlFor="input-copies"
                  >
                    <span>عدد النسخ المطلوبة (الكمية)</span>
                    <span className="text-slate-500 font-mono">نسخة للعميل</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      className="w-full h-11 px-4 pr-4 pl-12 rounded-xl bg-slate-50 text-slate-900 font-mono text-base text-left focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 border border-slate-200 transition"
                      id="input-copies"
                      min="0"
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                        setCopiesCount(isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      placeholder="0"
                      step="1"
                      type="number"
                      value={copiesCount === 0 ? "" : copiesCount}
                    />
                    <span className="absolute left-3 text-slate-400 text-xs pointer-events-none">
                      نسخة
                    </span>
                  </div>
                  <span className="text-slate-500 text-xs">
                    عدد الملازم أو الكتب للعميل / السنتر
                  </span>
                </div>
              </div>
              {/* Duplex / Single Selection */}
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700">
                  نوع طباعة الورق (وجه واحد أم وش وظهر)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="duplex-selector">
                  <button
                    className={`relative p-4 rounded-xl flex items-center justify-between transition-all cursor-pointer border ${
                      isDuplex
                        ? "bg-blue-50 text-blue-700 border-blue-300 shadow-xs"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
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
                    <div className="flex items-center gap-3 text-right">
                      <span className="material-symbols-outlined text-2xl">auto_stories</span>
                      <div>
                        <div className="text-sm font-bold">وش وظهر (Duplex)</div>
                        <div className="text-xs text-slate-500">
                          الافتراضي للملازم والكتب (يوفر 50% ورق)
                        </div>
                      </div>
                    </div>
                    <span
                      className={`material-symbols-outlined text-blue-600 ${
                        isDuplex ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      check_circle
                    </span>
                  </button>
                  <button
                    className={`relative p-4 rounded-xl flex items-center justify-between transition-all cursor-pointer border ${
                      !isDuplex
                        ? "bg-blue-50 text-blue-700 border-blue-300 shadow-xs"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
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
                    <div className="flex items-center gap-3 text-right">
                      <span className="material-symbols-outlined text-2xl">description</span>
                      <div>
                        <div className="text-sm font-bold">وجه واحد (Single-Sided)</div>
                        <div className="text-xs text-slate-500">
                          شيتات وامتحانات ورسم بياني ومذكرات فردية
                        </div>
                      </div>
                    </div>
                    <span
                      className={`material-symbols-outlined text-blue-600 ${
                        !isDuplex ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      check_circle
                    </span>
                  </button>
                </div>
              </div>
              {/* Dynamic Live Summary Pill Banner */}
              <div className="mt-4 p-3 rounded-xl bg-slate-50 flex flex-wrap items-center justify-between gap-3 border border-slate-200">
                <div className="flex items-center gap-2 text-slate-800 text-xs">
                  <span className="material-symbols-outlined text-blue-600 text-lg">insights</span>
                  <span className="text-slate-500 font-medium">النتيجة الحسابية:</span>
                  <span className="font-mono font-bold text-blue-700" id="banner-pages-calc">
                    {pageCount} صفحة {isDuplex ? "وش وظهر" : "وجه واحد"} = {sheetCountPerCopy} ورقة لكل نسخة
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">إجمالي الأوردر:</span>
                  <span className="font-mono text-xs font-bold text-emerald-700" id="banner-total-sheets">
                    {totalSheetsOrder.toLocaleString("ar-EG")} ورقة ({packetsA4Count} باكيت A4)
                  </span>
                </div>
              </div>
            </div>

            {/* Module 2: Paper & Print Price Presets */}
            <div className="bg-white rounded-2xl p-6 shadow-xs flex flex-col gap-4 border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-2xl">sell</span>
                  <span className="text-base font-bold text-slate-900">
                    أزرار تسعير الورقة والطباعة السريعة
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
                    <span>المحدد:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                      {rateLabel} {paperRate.toFixed(2)} ج.م
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsManageButtonsOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs text-blue-700 font-bold flex items-center gap-1 cursor-pointer transition border border-slate-200"
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    <span>إدارة وتعديل الأزرار</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Quick Presets Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3" id="preset-grid">
                {quickButtons.map((btn) => (
                  <button
                    key={btn.id}
                    className={`p-3.5 rounded-xl text-right flex flex-col justify-between h-20 transition-all cursor-pointer border relative group ${
                      paperRate === btn.price && rateLabel === btn.label
                        ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900"
                    }`}
                    onClick={() => handlePresetSelect(btn.price, btn.label)}
                    type="button"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold truncate max-w-[140px]">
                        {btn.label}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${btn.colorDot || "bg-blue-600"}`}></span>
                    </div>
                    <div className="font-mono text-lg font-bold">
                      {btn.price.toFixed(2)}{" "}
                      <span className="text-xs font-normal text-slate-500">ج.م</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Price Inline Input */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 gap-4 border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-lg">tune</span>
                  <span className="text-xs font-bold text-slate-700">أو تحديد سعر ورقة يدوي مخصص:</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="w-24 h-9 px-2 rounded-lg bg-white text-blue-600 font-mono text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 border border-slate-200 shadow-xs"
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
                  <span className="text-xs text-slate-500">ج.م للورقة</span>
                </div>
              </div>
            </div>

            {/* Module 3: Binding & Add-ons Finishes */}
            <div className="bg-white rounded-2xl p-6 shadow-xs flex flex-col gap-4 border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-2xl">book_online</span>
                  <h2 className="text-base font-bold text-slate-900">
                    خدمات التجليد والتشطيب (Add-ons)
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    سعر مضاف للنسخة
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsManageAddonsOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs text-blue-700 font-bold flex items-center gap-1 cursor-pointer transition border border-slate-200"
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    <span>إدارة وتعديل خدمات التجليد</span>
                  </button>
                </div>
              </div>

              {/* Spiral Wire Binding Options */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-600">
                  تجليد السلك المعدني (Spiral Wire Binding):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {customAddons.filter((a) => a.category === "wire").map((item) => {
                    const isSelected = selectedBinding?.name === item.name;
                    return (
                      <button
                        key={item.id}
                        className={`p-3 rounded-xl text-right flex flex-col justify-between transition-all cursor-pointer border ${
                          isSelected
                            ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                        }`}
                        onClick={() => setSelectedBinding(isSelected ? null : { name: item.name, price: item.price })}
                        type="button"
                      >
                        <span className="text-xs font-bold">{item.label}</span>
                        <span className="font-mono text-base mt-1 font-bold">
                          {item.price}{" "}
                          <span className="text-xs font-normal text-slate-500">ج.م</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Plastic Comb Binding Options */}
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-xs font-bold text-slate-600">
                  تجليد المشط البلاستيكي (Plastic Comb):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {customAddons.filter((a) => a.category === "plastic").map((item) => {
                    const isSelected = selectedBinding?.name === item.name;
                    return (
                      <button
                        key={item.id}
                        className={`p-3 rounded-xl text-right flex flex-col justify-between transition-all cursor-pointer border ${
                          isSelected
                            ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                        }`}
                        onClick={() => setSelectedBinding(isSelected ? null : { name: item.name, price: item.price })}
                        type="button"
                      >
                        <span className="text-xs font-bold">{item.label}</span>
                        <span className="font-mono text-base mt-1 font-bold">
                          {item.price}{" "}
                          <span className="text-xs font-normal text-slate-500">ج.م</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Extras: Finishing & Coatings */}
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-xs font-bold text-slate-600">
                  خدمات التشطيب والسلوفان الإضافية:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {customAddons.filter((a) => a.category === "finishing").map((item) => {
                    const isChecked = selectedFinishingIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        className={`p-3 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer border ${
                          isChecked
                            ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                        }`}
                        onClick={() => toggleFinishing(item.id)}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-blue-600 text-lg">
                            {isChecked ? "check_box" : "check_box_outline_blank"}
                          </span>
                          <span className="text-xs font-bold">{item.label}</span>
                        </div>
                        <span className="font-mono text-xs text-blue-700 font-bold">
                          +{item.price} ج.م
                        </span>
                      </button>
                    );
                  })}
                  <button
                    className="p-3 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                    onClick={() => {
                      setSelectedBinding(null);
                      setSelectedFinishingIds([]);
                    }}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                    <span className="text-xs font-semibold">إلغاء التجليد والتشطيب</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Left Column: Live Estimation Sticky Invoice Card (4 Cols on XL) */}
          <div className="xl:col-span-4 sticky top-20 flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-4 border border-slate-200">
              {/* Invoice Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-2xl">receipt_long</span>
                  <h3 className="text-base font-bold text-slate-900">
                    ملخص الفاتورة التقديرية
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={handleCopyInvoice}
                    title="نسخ الفاتورة نصياً"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg">content_copy</span>
                  </button>
                  <button
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={handleCopyInvoice}
                    title="مشاركة الفاتورة"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg">share</span>
                  </button>
                </div>
              </div>

              {/* Metric Rows */}
              <div className="flex flex-col gap-2 text-xs text-slate-800">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">عدد الصفحات الأصلية:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {pageCount} صفحة
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">نوع الطباعة:</span>
                  <span className="font-mono text-blue-600 font-bold">
                    {isDuplex ? "وش وظهر (Duplex)" : "وجه واحد (Single)"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">الورق الفعلي لكل نسخة:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {sheetCountPerCopy} ورقة
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">عدد النسخ المطلوبة:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {copiesCount} نسخة
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">إجمالي الورق المستخدم:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {totalSheetsOrder.toLocaleString("ar-EG")} ورقة (A4)
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">سعر الورقة المختارة:</span>
                  <span className="font-mono text-slate-900">
                    {paperRate.toFixed(2)} ج.م
                  </span>
                </div>

                <div className="my-1 h-px bg-slate-100"></div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">تكلفة الطباعة للنسخة:</span>
                  <span className="font-mono text-slate-900">
                    {printCostPerCopy.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">تكلفة التجليد والتشطيب:</span>
                  <span className="font-mono text-slate-900">
                    {bindingCostPerCopy.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 font-semibold">
                  <span className="text-slate-900">إجمالي تكلفة النسخة الواحدة:</span>
                  <span className="font-mono text-sm text-blue-600 font-bold">
                    {singleCopyTotalCost.toFixed(2)} ج.م
                  </span>
                </div>
              </div>

              {/* Big Highlight Grand Total Box */}
              <div className="p-4 rounded-xl bg-slate-50 flex flex-col items-center justify-center gap-1 text-center border border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  الإجمالي النهائي المطلوب
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-extrabold text-blue-600 tracking-tight">
                    {grandTotalCost.toLocaleString("ar-EG")}
                  </span>
                  <span className="text-sm font-bold text-blue-600">ج.م</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-medium">
                    تكلفة الإنتاج التقديرية: ~{estProductionCost.toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
              </div>

              {/* Fast Actions & Workflow Buttons */}
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  onClick={handleTransferToShiftOrder}
                  type="button"
                >
                  <span className="material-symbols-outlined text-lg">assignment_turned_in</span>
                  <span>تحويل إلى أوردر في الشفت فوراً</span>
                </button>
                <button
                  className="w-full h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-200"
                  onClick={handleSendWhatsappQuote}
                  type="button"
                >
                  <span className="material-symbols-outlined text-base text-emerald-600">send_to_mobile</span>
                  <span>إرسال عرض السعر للعميل عبر واتساب</span>
                </button>
                <button
                  className="w-full py-1.5 rounded-lg text-slate-500 hover:text-rose-600 text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  onClick={handleReset}
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  <span>تصفير الحسابات والبدء من جديد</span>
                </button>
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="p-4 rounded-xl bg-white flex items-start gap-3 border border-slate-200 shadow-xs">
              <span className="material-symbols-outlined text-amber-500 text-xl shrink-0 mt-0.5">
                tips_and_updates
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-900">
                  ملاحظة تسعير الملازم:
                </span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  الطباعة &apos;وش وظهر&apos; تحسب سعر الورقة كاملة متضمنة وجهي الطباعة. إذا كانت المذكرة فردية الصفحات (مثلاً 121 صفحة)، تُجبر آخر ورقة تلقائياً لضمان حساب التكلفة الصحيح.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal Dialog */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">settings</span>
                <h3 className="font-bold text-base text-slate-900">إعدادات أسعار الطباعة والتجليد الافتراضية</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <span className="font-bold text-blue-600 block">أسعار الورق والطباعة (ج.م للورقة):</span>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">أبيض وأسود (وجه):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={tempPricing.bwSingle}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, bwSingle: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">أبيض وأسود (وش وظهر):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={tempPricing.bwDuplex}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, bwDuplex: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">ألوان خفيف (وش وظهر):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={tempPricing.colorLightDuplex}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, colorLightDuplex: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">ألوان ملازم (وش وظهر):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={tempPricing.colorMediumDuplex}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, colorMediumDuplex: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
              </div>

              <span className="font-bold text-blue-600 block pt-2">أسعار التجليد (ج.م للنسخة):</span>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">سلك صغير:</label>
                  <input
                    type="number"
                    value={tempPricing.wireBindingSmall}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, wireBindingSmall: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">سلك وسط:</label>
                  <input
                    type="number"
                    value={tempPricing.wireBindingMed}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, wireBindingMed: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">سلوفان حراري:</label>
                  <input
                    type="number"
                    value={tempPricing.cellophane}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, cellophane: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">كعب غراء حراري:</label>
                  <input
                    type="number"
                    value={tempPricing.glue}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, glue: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSavePricing}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                حفظ الأسعار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Custom Quick Buttons Modal */}
      {isManageButtonsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">tune</span>
                <h3 className="font-bold text-base text-slate-900">إدارة وتعديل أزرار التسعير السريعة</h3>
              </div>
              <button
                onClick={() => {
                  setIsManageButtonsOpen(false);
                  setEditingBtnId(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Add New Button Form */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="font-bold text-xs text-blue-600 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>إضافة زر تسعير جديد</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <input
                  type="text"
                  placeholder="اسم الزر (مثلاً: ألوان خفيف)"
                  value={newBtnLabel}
                  onChange={(e) => setNewBtnLabel(e.target.value)}
                  className="sm:col-span-3 px-3 py-2 rounded-xl bg-white text-slate-900 border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  step="0.05"
                  placeholder="السعر ج.م"
                  value={newBtnPrice}
                  onChange={(e) => setNewBtnPrice(e.target.value)}
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-white text-slate-900 border border-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handleAddButton}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>إضافة إلى شاشة الحاسبة</span>
              </button>
            </div>

            {/* Existing Buttons List */}
            <div className="space-y-2">
              <span className="font-bold text-xs text-slate-600 block">
                الأزرار المتاحة حالياً ({quickButtons.length}):
              </span>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {quickButtons.map((btn) => (
                  <div
                    key={btn.id}
                    className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    {editingBtnId === btn.id ? (
                      <div className="flex-1 grid grid-cols-5 gap-2 items-center">
                        <input
                          type="text"
                          value={editBtnLabel}
                          onChange={(e) => setEditBtnLabel(e.target.value)}
                          className="col-span-3 px-2 py-1.5 rounded-lg bg-slate-50 text-slate-900 border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="number"
                          step="0.05"
                          value={editBtnPrice}
                          onChange={(e) => setEditBtnPrice(e.target.value)}
                          className="col-span-2 px-2 py-1.5 rounded-lg bg-slate-50 text-slate-900 border border-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${btn.colorDot || "bg-blue-600"}`}></span>
                        <span className="text-xs font-bold truncate text-slate-900">{btn.label}</span>
                        <span className="font-mono text-xs font-bold text-blue-600 mr-auto shrink-0">
                          {btn.price.toFixed(2)} ج.م
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      {editingBtnId === btn.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveEditButton(btn.id)}
                            className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 text-xs cursor-pointer"
                            title="حفظ"
                          >
                            <span className="material-symbols-outlined text-base">check</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingBtnId(null)}
                            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 text-xs cursor-pointer"
                            title="إلغاء"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBtnId(btn.id);
                              setEditBtnLabel(btn.label);
                              setEditBtnPrice(btn.price.toString());
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs cursor-pointer"
                            title="تعديل"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteButton(btn.id)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs cursor-pointer"
                            title="حذف"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetButtons}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                استعادة الأزرار الافتراضية
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsManageButtonsOpen(false);
                  setEditingBtnId(null);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                تم والعودة للحاسبة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Custom Add-ons Modal */}
      {isManageAddonsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">tune</span>
                <h3 className="font-bold text-base text-slate-900">إدارة وتعديل خدمات التجليد والتشطيب</h3>
              </div>
              <button
                onClick={() => {
                  setIsManageAddonsOpen(false);
                  setEditingAddonId(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Add New Add-on Form */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="font-bold text-xs text-blue-600 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>إضافة خدمة تجليد أو تشطيب جديدة</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <select
                  value={newAddonCategory}
                  onChange={(e) => setNewAddonCategory(e.target.value as "wire" | "plastic" | "finishing")}
                  className="sm:col-span-4 px-2 py-2 rounded-xl bg-white text-slate-900 border border-slate-200 text-xs font-bold focus:outline-none focus:border-blue-500"
                >
                  <option value="wire">سلك معدني</option>
                  <option value="plastic">مشط بلاستيكي</option>
                  <option value="finishing">تشطيب وسلوفان</option>
                </select>
                <input
                  type="text"
                  placeholder="اسم الخدمة (مثلاً: سلك سوبر كينج)"
                  value={newAddonName}
                  onChange={(e) => setNewAddonName(e.target.value)}
                  className="sm:col-span-5 px-3 py-2 rounded-xl bg-white text-slate-900 border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  step="0.5"
                  placeholder="السعر ج.م"
                  value={newAddonPrice}
                  onChange={(e) => setNewAddonPrice(e.target.value)}
                  className="sm:col-span-3 px-3 py-2 rounded-xl bg-white text-slate-900 border border-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handleAddAddon}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>إضافة الخدمة للحاسبة</span>
              </button>
            </div>

            {/* Existing Add-ons List */}
            <div className="space-y-2">
              <span className="font-bold text-xs text-slate-600 block">
                الخدمات المتاحة حالياً ({customAddons.length}):
              </span>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {customAddons.map((addon) => (
                  <div
                    key={addon.id}
                    className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    {editingAddonId === addon.id ? (
                      <div className="flex-1 grid grid-cols-12 gap-1.5 items-center">
                        <select
                          value={editAddonCategory}
                          onChange={(e) => setEditAddonCategory(e.target.value as "wire" | "plastic" | "finishing")}
                          className="col-span-4 px-1.5 py-1 rounded-lg bg-slate-50 text-slate-900 border border-slate-200 text-xs"
                        >
                          <option value="wire">سلك معدني</option>
                          <option value="plastic">مشط بلاستيك</option>
                          <option value="finishing">تشطيب وسلوفان</option>
                        </select>
                        <input
                          type="text"
                          value={editAddonName}
                          onChange={(e) => setEditAddonName(e.target.value)}
                          className="col-span-5 px-2 py-1 rounded-lg bg-slate-50 text-slate-900 border border-slate-200 text-xs"
                        />
                        <input
                          type="number"
                          step="0.5"
                          value={editAddonPrice}
                          onChange={(e) => setEditAddonPrice(e.target.value)}
                          className="col-span-3 px-1.5 py-1 rounded-lg bg-slate-50 text-slate-900 border border-slate-200 text-xs font-mono"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            addon.category === "wire"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : addon.category === "plastic"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}
                        >
                          {addon.category === "wire" ? "سلك" : addon.category === "plastic" ? "بلاستيك" : "تشطيب"}
                        </span>
                        <span className="text-xs font-bold truncate text-slate-900">{addon.name}</span>
                        <span className="font-mono text-xs font-bold text-blue-600 mr-auto shrink-0">
                          {addon.price.toFixed(2)} ج.م
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      {editingAddonId === addon.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveEditAddon(addon.id)}
                            className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 text-xs cursor-pointer"
                            title="حفظ"
                          >
                            <span className="material-symbols-outlined text-base">check</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAddonId(null)}
                            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 text-xs cursor-pointer"
                            title="إلغاء"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAddonId(addon.id);
                              setEditAddonName(addon.name);
                              setEditAddonPrice(addon.price.toString());
                              setEditAddonCategory(addon.category);
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs cursor-pointer"
                            title="تعديل"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAddon(addon.id)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs cursor-pointer"
                            title="حذف"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetAddons}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                استعادة الخدمات الافتراضية
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsManageAddonsOpen(false);
                  setEditingAddonId(null);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                تم والعودة للحاسبة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
