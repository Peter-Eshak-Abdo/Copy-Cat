"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/toast-provider";
import { safeOpenUrl } from "@/lib/utils";

export interface PrintTask {
  id: string;
  title: string;
  customerName: string;
  phone?: string;
  deadline: string;
  totalCopies: number;
  completedCopies: number;
  bindingType?: string;
  notes?: string;
  status: "pending" | "in_progress" | "ready" | "completed";
  createdAt: number;
  completedAt?: number;
}

const STORAGE_KEY = "copycat_tasks_v1";

const INITIAL_TASKS: PrintTask[] = [
  {
    id: "ORD-9421",
    title: "مذكرة ليلة الامتحان 1 ث - وش وظهر + غلاف كوشيه سلوفان",
    customerName: "أ. محمود عبد العال (فيزياء)",
    phone: "01012345678",
    deadline: "اليوم 6:00 م",
    totalCopies: 80,
    completedCopies: 48,
    bindingType: "تجليد سلك حلزوني 20مم + غلاف كريستال",
    notes: "طباعة وجهين، الغلاف ملون 250 جرام",
    status: "in_progress",
    createdAt: Date.now() - 1000 * 60 * 180,
  },
  {
    id: "ORD-9420",
    title: "شهادات تقدير أوائل الطلبة A4 ورق مقوى 250g ألوان",
    customerName: "مدرسة النصر الإعدادية",
    phone: "01198765432",
    deadline: "غداً 10:00 ص",
    totalCopies: 150,
    completedCopies: 150,
    bindingType: "سلوفان حراري لامع A4",
    notes: "ورق كوشيه 250 جرام ألوان عالي الجودة",
    status: "ready",
    createdAt: Date.now() - 1000 * 60 * 240,
    completedAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "ORD-9419",
    title: "سحب سكانر وتجهيز بطاقات رقم قومي A5 وش وظهر",
    customerName: "عميل نقدي (مكتب توثيق)",
    phone: "01210571251",
    deadline: "اليوم 3:00 م",
    totalCopies: 12,
    completedCopies: 12,
    bindingType: "بدون تجليد (فرط)",
    notes: "تجهيز وقص وتسليف فوري",
    status: "completed",
    createdAt: Date.now() - 1000 * 60 * 360,
    completedAt: Date.now() - 1000 * 60 * 60,
  },
];

function getCurrentShift(date: Date = new Date()): {
  id: "morning" | "evening";
  label: string;
  timeRange: string;
} {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // 8:30 AM to 4:00 PM
  if (totalMinutes >= 510 && totalMinutes < 960) {
    return {
      id: "morning",
      label: "شفت صباحي",
      timeRange: "08:30 ص - 04:00 م",
    };
  }

  return {
    id: "evening",
    label: "شفت مسائي",
    timeRange: "04:00 م - 12:00 ص",
  };
}

export default function TasksHandoverPage() {
  const toast = useToast();

  const [tasks, setTasks] = useState<PrintTask[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return INITIAL_TASKS;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PrintTask | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formTotalCopies, setFormTotalCopies] = useState<number>(50);
  const [formCompletedCopies, setFormCompletedCopies] = useState<number>(0);
  const [formBindingType, setFormBindingType] = useState("سلك حلزوني + غلاف شفاف");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<PrintTask["status"]>("in_progress");

  // Shift Handover Modal State
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);

  // Current dynamic shift
  const currentShift = getCurrentShift();

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      window.dispatchEvent(new Event("storage"));
    } catch {}
  }, [tasks]);

  // Telemetry Calculations
  const activeTasksCount = useMemo(
    () => tasks.filter((t) => t.status === "in_progress" || t.status === "pending").length,
    [tasks]
  );
  const inProgressCount = useMemo(
    () => tasks.filter((t) => t.status === "in_progress").length,
    [tasks]
  );
  const totalCompletedCopies = useMemo(
    () => tasks.reduce((sum, t) => sum + (t.completedCopies || 0), 0),
    [tasks]
  );
  const shiftCashVal = useMemo(
    () => tasks.reduce((sum, t) => sum + (t.completedCopies || 0) * 1.5, 0),
    [tasks]
  );

  const openAddModal = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormCustomerName("");
    setFormPhone("");
    setFormDeadline("اليوم 6:00 م");
    setFormTotalCopies(50);
    setFormCompletedCopies(0);
    setFormBindingType("سلك حلزوني + غلاف شفاف");
    setFormNotes("");
    setFormStatus("in_progress");
    setIsModalOpen(true);
  };

  const openEditModal = (task: PrintTask) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormCustomerName(task.customerName);
    setFormPhone(task.phone || "");
    setFormDeadline(task.deadline);
    setFormTotalCopies(task.totalCopies);
    setFormCompletedCopies(task.completedCopies);
    setFormBindingType(task.bindingType || "سلك حلزوني + غلاف شفاف");
    setFormNotes(task.notes || "");
    setFormStatus(task.status);
    setIsModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formCustomerName.trim()) {
      toast.warning("بيانات ناقصة", "يرجى كتابة عنوان العمل واسم العميل / المدرس");
      return;
    }

    if (editingTask) {
      const updated = tasks.map((t) => {
        if (t.id === editingTask.id) {
          const isDone = formStatus === "completed" || formCompletedCopies >= formTotalCopies;
          const targetStatus: PrintTask["status"] = isDone ? "completed" : formStatus;
          return {
            ...t,
            title: formTitle.trim(),
            customerName: formCustomerName.trim(),
            phone: formPhone.trim(),
            deadline: formDeadline.trim(),
            totalCopies: Number(formTotalCopies) || 1,
            completedCopies: Number(formCompletedCopies) || 0,
            bindingType: formBindingType,
            notes: formNotes.trim(),
            status: targetStatus,
            completedAt: isDone ? t.completedAt || Date.now() : undefined,
          };
        }
        return t;
      });
      setTasks(updated);
      toast.success("تم التعديل", "تم حفظ تعديلات المهمة بنجاح");
    } else {
      const newTask: PrintTask = {
        id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        title: formTitle.trim(),
        customerName: formCustomerName.trim(),
        phone: formPhone.trim(),
        deadline: formDeadline.trim(),
        totalCopies: Number(formTotalCopies) || 1,
        completedCopies: Number(formCompletedCopies) || 0,
        bindingType: formBindingType,
        notes: formNotes.trim(),
        status: formStatus,
        createdAt: Date.now(),
      };
      setTasks([newTask, ...tasks]);
      toast.success("تم تسجيل الأوردر", "تمت إضافة أوردر الطباعة الجديد إلى شفت اليوم بنجاح");
    }

    setIsModalOpen(false);
  };

  const handleDeleteTask = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا الأوردر من مهام الشفت؟")) {
      setTasks(tasks.filter((t) => t.id !== id));
      toast.success("تم الحذف", "تم حذف المهمة من سجل الشفت");
    }
  };

  const handleUpdateCopies = (id: string, delta: number) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const newCount = Math.max(0, Math.min(t.totalCopies, t.completedCopies + delta));
          const isDone = newCount >= t.totalCopies;
          return {
            ...t,
            completedCopies: newCount,
            status: isDone ? "completed" : newCount > 0 ? "in_progress" : "pending",
            completedAt: isDone ? Date.now() : undefined,
          };
        }
        return t;
      })
    );
  };

  const handleToggleStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus: PrintTask["status"] =
            t.status === "pending"
              ? "in_progress"
              : t.status === "in_progress"
              ? "ready"
              : t.status === "ready"
              ? "completed"
              : "in_progress";
          return {
            ...t,
            status: nextStatus,
            completedCopies: nextStatus === "completed" ? t.totalCopies : t.completedCopies,
            completedAt: nextStatus === "completed" ? Date.now() : undefined,
          };
        }
        return t;
      })
    );
  };

  const handleWhatsAppNotify = (task: PrintTask) => {
    if (!task.phone) {
      toast.warning("لا يوجد رقم", "لم يتم تسجيل رقم هاتف لهذا العميل");
      return;
    }
    let cleanPhone = task.phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "20" + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith("20") && cleanPhone.length === 10) {
      cleanPhone = "20" + cleanPhone;
    }

    const message = encodeURIComponent(
      `أهلاً أ/ ${task.customerName}، يسعدنا إبلاغك بأن طلبك (${task.title}) في مكتبة كوبي كات Copy Cat أصبح جاهزاً للاستلام. نتشرف بزيارتك في أي وقت.`
    );
    safeOpenUrl(`https://wa.me/${cleanPhone}?text=${message}`);
  };

  // Filtered Tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
        ? t.status === "in_progress" || t.status === "pending"
        : t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Shift Handover Report Text
  const generateHandoverReport = () => {
    const nowStr = new Date().toLocaleString("ar-EG", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const completedList = tasks.filter((t) => t.status === "completed" || t.status === "ready");
    const activeList = tasks.filter((t) => t.status === "in_progress" || t.status === "pending");

    let report = `📋 *تقرير تسليم شفت مطبعة كوبي كات Copy Cat*\n`;
    report += `🕒 التاريخ والوقت: ${nowStr}\n`;
    report += `🏢 الوردية: ${currentShift.label} (${currentShift.timeRange})\n`;
    report += `📄 إجمالي النسخ المطبوعة: ${totalCompletedCopies.toLocaleString("ar-EG")} ورقة\n`;
    report += `💵 نقدية الدرج المحصلة: ${shiftCashVal.toLocaleString("ar-EG")} ج.م\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    report += `✅ *الطلبات المنجزة والجاهزة للتسليم (${completedList.length}):*\n`;
    if (completedList.length === 0) {
      report += `• لا توجد طلبات مكتملة في هذه الوردية.\n`;
    } else {
      completedList.forEach((t, i) => {
        report += `${i + 1}. #${t.id} - ${t.title} [${t.customerName}] (${t.totalCopies} نسخة) [${
          t.status === "ready" ? "جاهز للتسليم" : "تم التسليم"
        }]\n`;
      });
    }

    report += `\n⏳ *الطلبات المتبقية للشفت القادم (${activeList.length}):*\n`;
    if (activeList.length === 0) {
      report += `• الشفت القادم خالٍ من أي أعمال متأخرة! 🎉\n`;
    } else {
      activeList.forEach((t, i) => {
        report += `${i + 1}. *#${t.id} - ${t.title}* [${t.customerName}]\n`;
        report += `   - الإنجاز: تم طباعة ${t.completedCopies} من ${t.totalCopies} نسخة (${Math.round(
          (t.completedCopies / t.totalCopies) * 100
        )}%)\n`;
        report += `   - موعد التسليم: ${t.deadline || "غير محدد"}\n`;
        if (t.bindingType) report += `   - التجليد: ${t.bindingType}\n`;
        if (t.notes) report += `   - ملاحظات: ${t.notes}\n`;
      });
    }

    report += `\n━━━━━━━━━━━━━━━━━━━━━\nالماكينات في حالة ممتازة ومخزون الورق متوفر. بالتوفيق لزملاء الشفت القادم! 👍`;
    return report;
  };

  const copyHandoverReport = async () => {
    const text = generateHandoverReport();
    try {
      await navigator.clipboard.writeText(text);
      toast.success("تم النسخ", "تم نسخ تقرير تسليم الشفت بصيغة واتساب جاهزة");
    } catch {
      toast.error("خطأ", "تعذر نسخ التقرير");
    }
  };

  const sendWhatsappHandover = () => {
    const text = encodeURIComponent(generateHandoverReport());
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  return (
    <div className="flex flex-col w-full pb-space-3xl gap-space-lg text-right" dir="rtl">
      {/* Breadcrumbs & Quick Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
        <div className="flex items-center gap-space-xs font-label-code text-label-code text-on-surface-variant">
          <span className="material-symbols-outlined text-sm text-primary">precision_manufacturing</span>
          <span>وحدة الإنتاج والتشغيل السريع</span>
          <span>/</span>
          <span className="text-primary font-semibold">{currentShift.label}</span>
          <span className="inline-flex items-center px-space-xs py-0.5 rounded-full bg-surface-container-high text-tertiary text-label-tag">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary ml-1.5 animate-pulse"></span>
            الإنتاج نشط ({currentShift.timeRange})
          </span>
        </div>
        <div className="flex items-center gap-space-sm">
          <span className="font-label-code text-label-code text-on-surface-variant">
            إجمالي الأوردرات المسجلة: <strong className="text-on-surface font-mono">{tasks.length} أوردر</strong>
          </span>
        </div>
      </div>

      {/* Main Hero Card: Page Title & Global Shift Actions */}
      <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-lg shadow-xl border border-surface-container-high/40">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 right-1/3 w-80 h-80 rounded-full bg-primary-container/10 blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg">
          <div className="flex flex-col gap-space-2xs max-w-2xl">
            <div className="flex items-center gap-space-sm">
              <div className="p-space-xs rounded-xl bg-primary-container/15 text-primary">
                <span className="material-symbols-outlined text-2xl">assignment_turned_in</span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
                مهام وأوردرات الشفت وتسليم الورديات
              </h1>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              إدارة أوردرات وملازم المدرسين والعملاء، عداد النسخ المطبوعة الحي، إرسال تنبيهات واتساب بنقرة واحدة، وتوليد تقرير استلام وتسليم الشفت بالكامل لعهدة الكاشير والماكينات.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-space-sm">
            <button
              className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container-highest hover:bg-surface-bright text-primary font-body-sm text-body-sm font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
              onClick={() => setIsHandoverModalOpen(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-lg">fact_check</span>
              <span>تقرير تسليم الشفت</span>
            </button>
            <button
              className="flex items-center gap-space-xs px-space-lg py-space-sm rounded-xl bg-primary hover:bg-primary-fixed text-on-primary font-body-sm text-body-sm font-bold shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 active:scale-95 cursor-pointer"
              onClick={openAddModal}
              type="button"
            >
              <span className="material-symbols-outlined text-xl">add_circle</span>
              <span>+ أوردر طباعة جديد</span>
            </button>
          </div>
        </div>
      </section>

      {/* Live Shift Telemetry Metric Bar */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
        <div className="rounded-xl bg-surface-container-low p-space-md shadow-md flex flex-col justify-between relative overflow-hidden border border-surface-container-high/40">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-tag text-label-tag tracking-wider uppercase">الأوردرات الجارية</span>
            <span className="material-symbols-outlined text-primary text-xl">print</span>
          </div>
          <div className="mt-space-sm flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg text-on-surface font-bold font-mono">
              {activeTasksCount}
            </span>
            <span className="font-label-code text-label-code text-primary bg-primary/10 px-space-xs py-0.5 rounded-lg">
              {inProgressCount} قيد التنفيذ
            </span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full mt-space-sm overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${tasks.length ? (activeTasksCount / tasks.length) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container-low p-space-md shadow-md flex flex-col justify-between relative overflow-hidden border border-surface-container-high/40">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-tag text-label-tag tracking-wider uppercase">النسخ المنجزة بالشفت</span>
            <span className="material-symbols-outlined text-tertiary text-xl">layers</span>
          </div>
          <div className="mt-space-sm flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg text-on-surface font-bold font-mono">
              {totalCompletedCopies.toLocaleString("ar-EG")}
            </span>
            <span className="font-label-code text-label-code text-tertiary bg-tertiary/10 px-space-xs py-0.5 rounded-lg">
              {currentShift.label}
            </span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full mt-space-sm overflow-hidden">
            <div className="bg-tertiary h-full rounded-full" style={{ width: "85%" }}></div>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container-low p-space-md shadow-md flex flex-col justify-between relative overflow-hidden border border-surface-container-high/40">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-tag text-label-tag tracking-wider uppercase">نقدية الدرج المحصلة</span>
            <span className="material-symbols-outlined text-primary text-xl">payments</span>
          </div>
          <div className="mt-space-sm flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg text-on-surface font-bold font-mono">
              {shiftCashVal.toLocaleString("ar-EG")}{" "}
              <span className="text-body-sm font-normal text-on-surface-variant">ج.م</span>
            </span>
            <span className="font-label-code text-label-code text-primary bg-primary/10 px-space-xs py-0.5 rounded-lg">
              مطابق للنسخ
            </span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full mt-space-sm overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: "100%" }}></div>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container-low p-space-md shadow-md flex flex-col justify-between relative overflow-hidden border border-surface-container-high/40">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-label-tag text-label-tag tracking-wider uppercase">كفاءة تشغيل الماكينات</span>
            <span className="material-symbols-outlined text-secondary text-xl">speed</span>
          </div>
          <div className="mt-space-sm flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg text-on-surface font-bold font-mono">98.4%</span>
            <span className="font-label-code text-label-code text-secondary bg-secondary-container/20 px-space-xs py-0.5 rounded-lg">
              4 ماكينات جاهزة
            </span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full mt-space-sm overflow-hidden">
            <div className="bg-secondary-container h-full rounded-full" style={{ width: "98%" }}></div>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-space-sm bg-surface-container-low p-space-sm rounded-xl border border-surface-container-high/40 shadow-sm">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم العمل، العميل، رقم الأوردر..."
            className="w-full pr-9 pl-4 py-2 rounded-xl bg-surface-container text-on-surface font-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-surface-container-high"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-container-lowest rounded-xl overflow-x-auto w-full md:w-auto border border-surface-container-high/50">
          {[
            { key: "all", label: "الكل" },
            { key: "active", label: "الطلبات الجارية" },
            { key: "pending", label: "في الانتظار" },
            { key: "in_progress", label: "جاري الطباعة" },
            { key: "ready", label: "جاهز للتسليم" },
            { key: "completed", label: "تم التسليم" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              type="button"
              className={`px-space-md py-space-xs rounded-lg font-body-sm text-body-sm whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === tab.key
                  ? "bg-surface-container-highest text-primary font-bold shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List / Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full p-space-3xl rounded-xl bg-surface-container-low border border-dashed border-surface-container-high text-center text-on-surface-variant flex flex-col items-center justify-center gap-space-xs">
            <span className="material-symbols-outlined text-4xl opacity-40">inventory_2</span>
            <p className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              لا توجد طلبات تطابق هذا البحث
            </p>
            <p className="font-body-sm text-body-sm">أضف أوردرات جديدة أو قم بتغيير خيارات التصفية بالأعلى</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const progress = Math.min(100, Math.round((task.completedCopies / task.totalCopies) * 100));
            return (
              <div
                key={task.id}
                className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low border border-surface-container-high/40 shadow-md hover:border-primary/40 transition-all gap-space-sm"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-space-xs">
                  <div className="flex flex-col gap-1">
                    <span className="font-label-code text-label-code text-primary font-bold">
                      #{task.id}
                    </span>
                    <h3 className="font-headline-sm text-body-lg font-bold text-on-surface line-clamp-2 leading-snug">
                      {task.title}
                    </h3>
                  </div>
                  <span
                    onClick={() => handleToggleStatus(task.id)}
                    className={`inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full font-label-tag text-label-tag cursor-pointer select-none transition-all ${
                      task.status === "in_progress"
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : task.status === "ready"
                        ? "bg-secondary-container/20 text-secondary border border-secondary-container/40"
                        : task.status === "completed"
                        ? "bg-surface-container-highest text-on-surface-variant"
                        : "bg-surface-container text-tertiary border border-tertiary/30"
                    }`}
                    title="اضغط لتغيير الحالة فورياً"
                  >
                    {task.status === "in_progress" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                    )}
                    {task.status === "in_progress"
                      ? "جاري الطباعة"
                      : task.status === "ready"
                      ? "جاهز للتسليم"
                      : task.status === "completed"
                      ? "تم التسليم"
                      : "في الانتظار"}
                  </span>
                </div>

                {/* Details Meta */}
                <div className="flex flex-col gap-1 text-on-surface-variant font-body-sm text-body-sm py-1 border-y border-surface-container-high/40">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-on-surface">العميل / المدرس:</span>
                    <span className="font-semibold text-primary">{task.customerName}</span>
                  </div>
                  {task.deadline && (
                    <div className="flex items-center justify-between text-xs">
                      <span>موعد التسليم:</span>
                      <span className="font-label-code">{task.deadline}</span>
                    </div>
                  )}
                  {task.bindingType && (
                    <div className="flex items-center justify-between text-xs">
                      <span>التجليد والتشطيب:</span>
                      <span className="text-on-surface">{task.bindingType}</span>
                    </div>
                  )}
                  {task.notes && (
                    <p className="text-xs text-on-surface-variant bg-surface-container p-1.5 rounded-lg mt-1 italic line-clamp-2">
                      {task.notes}
                    </p>
                  )}
                </div>

                {/* Progress bar & Counter Adjuster */}
                <div className="flex flex-col gap-space-2xs">
                  <div className="flex items-center justify-between text-xs font-label-code">
                    <span className="text-on-surface-variant">
                      تم طباعة: {task.completedCopies} / {task.totalCopies} نسخة
                    </span>
                    <span className="font-bold text-primary">{progress}%</span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>

                  {/* Counter Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateCopies(task.id, -5)}
                        className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold"
                        title="-5 نسخ"
                      >
                        -5
                      </button>
                      <button
                        onClick={() => handleUpdateCopies(task.id, -1)}
                        className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold"
                        title="-1 نسخة"
                      >
                        -1
                      </button>
                      <button
                        onClick={() => handleUpdateCopies(task.id, 1)}
                        className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold text-primary"
                        title="+1 نسخة"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleUpdateCopies(task.id, 5)}
                        className="px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold text-primary"
                        title="+5 نسخ"
                      >
                        +5
                      </button>
                    </div>

                    {/* Action icons */}
                    <div className="flex items-center gap-1">
                      {task.phone && (
                        <button
                          onClick={() => handleWhatsAppNotify(task)}
                          className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-bright text-primary transition-colors cursor-pointer"
                          title="إرسال إشعار واتساب للعميل"
                        >
                          <span className="material-symbols-outlined text-base">chat</span>
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(task)}
                        className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface transition-colors cursor-pointer"
                        title="تعديل تفاصيل الأوردر"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 rounded-lg bg-surface-container hover:bg-error/20 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                        title="حذف الأوردر"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: New / Edit Task */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface-container-low border border-surface-container-high rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">assignment</span>
                <h3 className="font-bold text-lg text-on-surface">
                  {editingTask ? "تعديل أوردر الطباعة" : "تسجيل أوردر طباعة جديد للشفت"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="flex flex-col gap-space-sm">
              <div className="flex flex-col gap-1">
                <label className="font-label-tag text-label-tag text-on-surface-variant">
                  عنوان المذكرة أو العمل *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: مذكرة كيمياء تانية ثانوي أ/ عاطف"
                  className="w-full px-space-sm py-space-xs rounded-xl bg-surface-container text-on-surface font-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-surface-container-high"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-1">
                  <label className="font-label-tag text-label-tag text-on-surface-variant">
                    اسم العميل / المدرس *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    placeholder="أ/ عاطف النجار"
                    className="w-full px-space-sm py-space-xs rounded-xl bg-surface-container text-on-surface font-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-surface-container-high"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-tag text-label-tag text-on-surface-variant">
                    رقم هاتف الواتساب
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className="w-full px-space-sm py-space-xs rounded-xl bg-surface-container text-on-surface font-body-sm font-mono text-left focus:outline-none focus:ring-2 focus:ring-primary border border-surface-container-high"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
                <div className="flex flex-col gap-1">
                  <label className="font-label-tag text-label-tag text-on-surface-variant">
                    عدد النسخ المطلوب
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formTotalCopies}
                    onChange={(e) => setFormTotalCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-space-sm py-space-xs rounded-xl bg-surface-container text-on-surface font-body-sm font-mono focus:outline-none border border-surface-container-high"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-tag text-label-tag text-on-surface-variant">
                    النسخ المكتملة حالياً
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formCompletedCopies}
                    onChange={(e) => setFormCompletedCopies(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-space-sm py-space-xs rounded-xl bg-surface-container text-on-surface font-body-sm font-mono focus:outline-none border border-surface-container-high"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-tag text-label-tag text-on-surface-variant">
                    موعد التسليم المتوقع
                  </label>
                  <input
                    type="text"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    placeholder="اليوم 8:00 م"
                    className="w-full px-space-sm py-space-xs rounded-xl bg-surface-container text-on-surface font-body-sm focus:outline-none border border-surface-container-high"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-1">
                  <label className="font-label-tag text-label-tag text-on-surface-variant">
                    نوع التجليد والتشطيب
                  </label>
                  <select
                    value={formBindingType}
                    onChange={(e) => setFormBindingType(e.target.value)}
                    className="w-full px-space-sm py-space-xs rounded-xl bg-surface-container text-on-surface font-body-sm focus:outline-none border border-surface-container-high"
                  >
                    <option value="سلك حلزوني + غلاف شفاف">سلك حلزوني + غلاف شفاف</option>
                    <option value="تجليد سلك معدني 20مم">تجليد سلك معدني 20مم</option>
                    <option value="دبوسين نصف (ملازم)">دبوسين نصف (ملازم)</option>
                    <option value="تجليد حراري (غراء كعب)">تجليد حراري (غراء كعب)</option>
                    <option value="سلوفان حراري لامع A4">سلوفان حراري لامع A4</option>
                    <option value="سلوفان حراري مط A4">سلوفان حراري مط A4</option>
                    <option value="بدون تجليد (فرط)">بدون تجليد (فرط)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-tag text-label-tag text-on-surface-variant">
                    حالة المهمة
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as PrintTask["status"])}
                    className="w-full px-space-sm py-space-xs rounded-xl bg-surface-container text-on-surface font-body-sm focus:outline-none border border-surface-container-high"
                  >
                    <option value="pending">في الانتظار (لم تبدأ)</option>
                    <option value="in_progress">جاري الطباعة والتنفيذ</option>
                    <option value="ready">جاهز للتسليم للعميل</option>
                    <option value="completed">تم التسليم واستلام الحساب</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-tag text-label-tag text-on-surface-variant">
                  الملاحظات الفنية للطباعة
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="نوع الورق، طباعة ملونة أم أبيض وأسود، خامة الغلاف..."
                  className="w-full p-space-xs rounded-xl bg-surface-container text-on-surface font-body-sm focus:outline-none border border-surface-container-high"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-space-sm pt-space-xs mt-2 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-space-md py-space-xs rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1 px-space-lg py-space-xs rounded-xl bg-primary hover:bg-primary-fixed text-on-primary font-body-sm font-bold shadow-lg shadow-primary/25 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>{editingTask ? "حفظ التعديلات" : "حفظ وإرسال للماكينة"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Shift Handover Report */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface-container-low border border-surface-container-high rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">fact_check</span>
                <div>
                  <h3 className="font-bold text-lg text-on-surface">تقرير تسليم واستلام الشفت</h3>
                  <span className="text-xs text-on-surface-variant font-label-code">
                    {currentShift.label} ({currentShift.timeRange})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsHandoverModalOpen(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Shift Stats Card */}
            <div className="grid grid-cols-2 gap-space-sm">
              <div className="p-space-sm rounded-xl bg-surface-container">
                <span className="text-xs text-on-surface-variant block">النسخ المطبوعة بالشفت:</span>
                <span className="text-xl font-bold font-mono text-tertiary">
                  {totalCompletedCopies.toLocaleString("ar-EG")} ورقة
                </span>
              </div>
              <div className="p-space-sm rounded-xl bg-surface-container">
                <span className="text-xs text-on-surface-variant block">عهدة النقدية بالدرج:</span>
                <span className="text-xl font-bold font-mono text-primary">
                  {shiftCashVal.toLocaleString("ar-EG")} ج.م
                </span>
              </div>
            </div>

            {/* Generated Text View */}
            <div className="p-space-sm rounded-xl bg-surface-container-lowest border border-surface-container-high/60 font-mono text-xs text-on-surface max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
              {generateHandoverReport()}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-space-sm pt-2 border-t border-surface-container-high">
              <button
                type="button"
                onClick={copyHandoverReport}
                className="flex items-center gap-1.5 px-space-md py-space-xs rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm font-semibold cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">content_copy</span>
                <span>نسخ التقرير</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={sendWhatsappHandover}
                  className="flex items-center gap-1.5 px-space-md py-space-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-body-sm font-semibold cursor-pointer shadow-md"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                  <span>إرسال للشفت القادم واتساب</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsHandoverModalOpen(false);
                    toast.success("تم توثيق الشفت", "تم اعتماد تقرير تسليم الوردية بنجاح");
                  }}
                  className="px-space-md py-space-xs rounded-xl bg-primary text-on-primary font-body-sm font-bold shadow-md cursor-pointer"
                >
                  اعتماد وإغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
