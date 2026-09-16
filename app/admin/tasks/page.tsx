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

const INITIAL_TASKS: PrintTask[] = [];

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
    <div className="flex flex-col w-full pb-12 space-y-6 text-right" dir="rtl">
      {/* Breadcrumbs & Quick Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span className="material-symbols-outlined text-sm text-blue-600">print</span>
          <span>متابعة طلبات الطباعة</span>
          <span>/</span>
          <span className="text-blue-600 font-bold">{currentShift.label}</span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1.5 animate-pulse"></span>
            الشفت شغال ({currentShift.timeRange})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            إجمالي أوردرات اليوم: <strong className="text-slate-900 font-mono">{tasks.length} أوردر</strong>
          </span>
        </div>
      </div>

      {/* Main Hero Card: Page Title & Global Shift Actions */}
      <section className="rounded-2xl bg-white p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5 max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <span className="material-symbols-outlined text-2xl">receipt_long</span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                أوردرات الطباعة وتسليم الشفت
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              سجل واستلم ملازم وورق المدرسين والطلبة، تابع النسخ المطبوعة أولاً بأول، وابعث رسالة جاهزة للزبون على الواتساب أول ما حاجته تخلص.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition border border-slate-200 cursor-pointer"
              onClick={() => setIsHandoverModalOpen(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-lg">fact_check</span>
              <span>تقرير تسليم الشفت</span>
            </button>
            <button
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
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
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-xs flex flex-col justify-between border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>الأوردرات الجارية</span>
            <span className="material-symbols-outlined text-blue-600 text-xl">print</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {activeTasksCount}
            </span>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
              {inProgressCount} قيد التنفيذ
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all"
              style={{ width: `${tasks.length ? (activeTasksCount / tasks.length) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-xs flex flex-col justify-between border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>النسخ المنجزة بالشفت</span>
            <span className="material-symbols-outlined text-indigo-600 text-xl">layers</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {totalCompletedCopies.toLocaleString("ar-EG")}
            </span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
              {currentShift.label}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full" style={{ width: "85%" }}></div>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم العمل، العميل، رقم الأوردر..."
            className="w-full pr-9 pl-4 py-2 rounded-xl bg-slate-50 text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-blue-500 border border-slate-200 transition"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-xl overflow-x-auto w-full md:w-auto border border-slate-200">
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
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition cursor-pointer font-bold ${
                statusFilter === tab.key
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List / Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full p-12 rounded-2xl bg-white border border-dashed border-slate-200 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span>
            <p className="text-base font-bold text-slate-900">
              لا توجد طلبات تطابق هذا البحث
            </p>
            <p className="text-xs text-slate-500">أضف أوردرات جديدة أو قم بتغيير خيارات التصفية بالأعلى</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const progress = Math.min(100, Math.round((task.completedCopies / task.totalCopies) * 100));
            return (
              <div
                key={task.id}
                className="flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition-all gap-3"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs text-blue-600 font-bold">
                      #{task.id}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug">
                      {task.title}
                    </h3>
                  </div>
                  <span
                    onClick={() => handleToggleStatus(task.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold cursor-pointer select-none transition ${
                      task.status === "in_progress"
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : task.status === "ready"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : task.status === "completed"
                        ? "bg-slate-100 text-slate-600 border border-slate-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                    title="اضغط لتغيير الحالة فورياً"
                  >
                    {task.status === "in_progress" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
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
                <div className="flex flex-col gap-1.5 text-slate-500 text-xs py-2 border-y border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">العميل / المدرس:</span>
                    <span className="font-bold text-slate-900">{task.customerName}</span>
                  </div>
                  {task.deadline && (
                    <div className="flex items-center justify-between text-xs">
                      <span>موعد التسليم:</span>
                      <span className="font-mono font-medium text-slate-700">{task.deadline}</span>
                    </div>
                  )}
                  {task.bindingType && (
                    <div className="flex items-center justify-between text-xs">
                      <span>التجليد والتشطيب:</span>
                      <span className="text-slate-800 font-medium">{task.bindingType}</span>
                    </div>
                  )}
                  {task.notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl mt-1 italic line-clamp-2 border border-slate-100">
                      {task.notes}
                    </p>
                  )}
                </div>

                {/* Progress bar & Counter Adjuster */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500">
                      تم طباعة: {task.completedCopies} / {task.totalCopies} نسخة
                    </span>
                    <span className="font-bold text-blue-600">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>

                  {/* Counter Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateCopies(task.id, -5)}
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer"
                        title="-5 نسخ"
                      >
                        -5
                      </button>
                      <button
                        onClick={() => handleUpdateCopies(task.id, -1)}
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer"
                        title="-1 نسخة"
                      >
                        -1
                      </button>
                      <button
                        onClick={() => handleUpdateCopies(task.id, 1)}
                        className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700 border border-blue-200 cursor-pointer"
                        title="+1 نسخة"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleUpdateCopies(task.id, 5)}
                        className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-700 border border-blue-200 cursor-pointer"
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
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer"
                          title="إرسال إشعار واتساب للعميل"
                        >
                          <span className="material-symbols-outlined text-base">chat</span>
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(task)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                        title="تعديل تفاصيل الأوردر"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-xl">assignment</span>
                <h3 className="font-bold text-base text-slate-900">
                  {editingTask ? "تعديل أوردر الطباعة" : "تسجيل أوردر طباعة جديد للشفت"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">
                  عنوان المذكرة أو العمل *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: مذكرة كيمياء تانية ثانوي أ/ عاطف"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-blue-500 border border-slate-200 transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">
                    اسم العميل / المدرس *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    placeholder="أ/ عاطف النجار"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-blue-500 border border-slate-200 transition"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">
                    رقم هاتف الواتساب
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 text-xs font-mono text-left focus:outline-none focus:bg-white focus:border-blue-500 border border-slate-200 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">
                    عدد النسخ المطلوب
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formTotalCopies}
                    onChange={(e) => setFormTotalCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 text-xs font-mono focus:outline-none focus:bg-white focus:border-blue-500 border border-slate-200 transition"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">
                    النسخ المكتملة
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formCompletedCopies}
                    onChange={(e) => setFormCompletedCopies(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 text-xs font-mono focus:outline-none focus:bg-white focus:border-blue-500 border border-slate-200 transition"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">
                    موعد التسليم المتوقع
                  </label>
                  <input
                    type="text"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    placeholder="اليوم 8:00 م"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-blue-500 border border-slate-200 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">
                    نوع التجليد والتشطيب
                  </label>
                  <select
                    value={formBindingType}
                    onChange={(e) => setFormBindingType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-blue-500 border border-slate-200 transition cursor-pointer"
                  >
                    <option value="سلك حلزوني + غلاف شفاف">سلك حلزوني + غلاف شفاف</option>
                    <option value="تجليد سلك معدني 20مم">تجليد سلك معدني 20مم</option>
                    <option value="دبوسين نصف (ملازم)">دبوسين نصف (ملازم)</option>
                    <option value="سلوفان حراري لامع A4">سلوفان حراري لامع A4</option>
                    <option value="سلوفان حراري مط A4">سلوفان حراري مط A4</option>
                    <option value="بدون تجليد (فرط)">بدون تجليد (فرط)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">
                    حالة المهمة
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as PrintTask["status"])}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-blue-500 border border-slate-200 transition cursor-pointer"
                  >
                    <option value="pending">في الانتظار (لم تبدأ)</option>
                    <option value="in_progress">جاري الطباعة والتنفيذ</option>
                    <option value="ready">جاهز للتسليم للعميل</option>
                    <option value="completed">تم التسليم واستلام الحساب</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">
                  الملاحظات الفنية للطباعة
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="نوع الورق، طباعة ملونة أم أبيض وأسود، خامة الغلاف..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-blue-500 border border-slate-200 transition"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 mt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-2xl">fact_check</span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">تقرير تسليم واستلام الشفت</h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {currentShift.label} ({currentShift.timeRange})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsHandoverModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Shift Stats Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block mb-1">النسخ المطبوعة بالشفت:</span>
              <span className="text-xl font-bold font-mono text-indigo-700">
                {totalCompletedCopies.toLocaleString("ar-EG")} ورقة
              </span>
            </div>

            {/* Generated Text View */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
              {generateHandoverReport()}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={copyHandoverReport}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer border border-slate-200"
              >
                <span className="material-symbols-outlined text-base">content_copy</span>
                <span>نسخ التقرير</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={sendWhatsappHandover}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs"
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
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
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
