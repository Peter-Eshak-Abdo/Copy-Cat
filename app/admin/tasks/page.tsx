"use client";

import React, { useState, useEffect } from "react";
import {
  CheckSquare,
  Plus,
  Trash2,
  Edit2,
  Clock,
  Phone,
  MessageCircle,
  FileText,
  Copy,
  CheckCircle2,
  Search,
} from "lucide-react";
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
    id: "task-1",
    title: "مذكرة فيزياء أولى ثانوي - ترم أول",
    customerName: "أ/ محمد سامي",
    phone: "01012345678",
    deadline: "اليوم 6:00 م",
    totalCopies: 50,
    completedCopies: 32,
    bindingType: "تجليد سلك حلزوني 20مم + غلاف كريستال",
    notes: "طباعة وجهين، الغلاف ملون 250 جرام",
    status: "in_progress",
    createdAt: Date.now() - 1000 * 60 * 180,
  },
  {
    id: "task-2",
    title: "ملازم لغة عربية - مراجعة ليلة الامتحان",
    customerName: "مدرسة الفتح",
    phone: "01198765432",
    deadline: "غداً 10:00 ص",
    totalCopies: 120,
    completedCopies: 0,
    bindingType: "دبوسين نص",
    notes: "ورق 70 جرام أبيض وجه وظهر",
    status: "pending",
    createdAt: Date.now() - 1000 * 60 * 90,
  },
  {
    id: "task-3",
    title: "شهادات تقدير خريجين دورة حاسب",
    customerName: "أكاديمية المستقبل",
    phone: "01234567890",
    deadline: "اليوم 3:00 م",
    totalCopies: 25,
    completedCopies: 25,
    bindingType: "سلوفان حراري لامع A4",
    notes: "طباعة ورق كوشيه ألوان عالي الجودة",
    status: "ready",
    createdAt: Date.now() - 1000 * 60 * 300,
    completedAt: Date.now() - 1000 * 60 * 30,
  },
];

export default function TasksHandoverPage() {
  const toast = useToast();

  const [tasks, setTasks] = useState<PrintTask[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore error
        }
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
  const [formTotalCopies, setFormTotalCopies] = useState<number>(10);
  const [formCompletedCopies, setFormCompletedCopies] = useState<number>(0);
  const [formBindingType, setFormBindingType] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<PrintTask["status"]>("pending");

  // Shift Handover Modal State
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  const openAddModal = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormCustomerName("");
    setFormPhone("");
    setFormDeadline("");
    setFormTotalCopies(10);
    setFormCompletedCopies(0);
    setFormBindingType("");
    setFormNotes("");
    setFormStatus("pending");
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
    setFormBindingType(task.bindingType || "");
    setFormNotes(task.notes || "");
    setFormStatus(task.status);
    setIsModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formCustomerName.trim()) {
      toast.warning("بيانات ناقصة", "يرجى كتابة عنوان العمل واسم العميل / الأستاذ");
      return;
    }

    if (editingTask) {
      // Update
      const updated = tasks.map((t) => {
        if (t.id === editingTask.id) {
          const isNowCompleted = formStatus === "completed" || formCompletedCopies >= formTotalCopies;
          const targetStatus: PrintTask["status"] = isNowCompleted ? "completed" : formStatus;
          return {
            ...t,
            title: formTitle.trim(),
            customerName: formCustomerName.trim(),
            phone: formPhone.trim(),
            deadline: formDeadline.trim(),
            totalCopies: Number(formTotalCopies) || 1,
            completedCopies: Number(formCompletedCopies) || 0,
            bindingType: formBindingType.trim(),
            notes: formNotes.trim(),
            status: targetStatus,
            completedAt: isNowCompleted ? t.completedAt || Date.now() : undefined,
          };
        }
        return t;
      });
      setTasks(updated);
      toast.success("تم التعديل", "تم حفظ تعديلات المهمة بنجاح");
    } else {
      // Create new
      const newTask: PrintTask = {
        id: `task-${Date.now()}`,
        title: formTitle.trim(),
        customerName: formCustomerName.trim(),
        phone: formPhone.trim(),
        deadline: formDeadline.trim(),
        totalCopies: Number(formTotalCopies) || 1,
        completedCopies: Number(formCompletedCopies) || 0,
        bindingType: formBindingType.trim(),
        notes: formNotes.trim(),
        status: formStatus,
        createdAt: Date.now(),
      };
      setTasks([newTask, ...tasks]);
      toast.success("تمت الإضافة", "تمت إضافة مهمة الطباعة الجديدة");
    }

    setIsModalOpen(false);
  };

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
    toast.success("تم الحذف", "تم حذف المهمة من السجل");
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
          const isCompleted = t.status === "completed";
          return {
            ...t,
            status: isCompleted ? "in_progress" : "completed",
            completedCopies: isCompleted ? Math.max(0, t.totalCopies - 1) : t.totalCopies,
            completedAt: isCompleted ? undefined : Date.now(),
          };
        }
        return t;
      })
    );
  };

  const handleWhatsAppChat = (phone: string, title: string, customerName: string) => {
    if (!phone) {
      toast.warning("لا يوجد رقم", "لم يتم تسجيل رقم هاتف لهذا العميل");
      return;
    }
    // Clean phone number (Egypt format)
    let cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "20" + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith("20") && cleanPhone.length === 10) {
      cleanPhone = "20" + cleanPhone;
    }

    const message = encodeURIComponent(
      `أهلاً أ/ ${customerName}، بخصوص طلبك (${title}) في مركز الطباعة والتصوير: الطلب جاهز للتسليم، يسعدنا تشريفك.`
    );
    safeOpenUrl(`https://wa.me/${cleanPhone}?text=${message}`);
  };

  // Filtered Tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
        ? t.status !== "completed"
        : t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Handover Report Text Generator
  const generateHandoverReport = () => {
    const nowStr = new Date().toLocaleString("ar-EG", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const completedList = tasks.filter((t) => t.status === "completed" || t.status === "ready");
    const activeList = tasks.filter((t) => t.status === "in_progress" || t.status === "pending");

    let report = `📋 *تقرير تسليم شيفت المكتبة (Copy-Cat)*\n`;
    report += `🕒 التاريخ والوقت: ${nowStr}\n`;
    report += `------------------------------------\n\n`;

    report += `✅ *الطلبات المنجزة والجاهزة للتسليم (${completedList.length}):*\n`;
    if (completedList.length === 0) {
      report += `• لا توجد طلبات منجزة في هذا الشيفت.\n`;
    } else {
      completedList.forEach((t, i) => {
        report += `${i + 1}. ${t.title} - ${t.customerName} (${t.totalCopies} نسخة) [${
          t.status === "ready" ? "جاهز للتسليم" : "تم تسليمه"
        }]\n`;
      });
    }

    report += `\n⏳ *الطلبات الجارية والمتبقية للشيفت القادم (${activeList.length}):*\n`;
    if (activeList.length === 0) {
      report += `• الشيفت القادم خالٍ من أي أعمال متأخرة! 🎉\n`;
    } else {
      activeList.forEach((t, i) => {
        report += `${i + 1}. *${t.title}* - أ/ ${t.customerName}\n`;
        report += `   - الإنجاز: تم طباعة ${t.completedCopies} من إجمالي ${t.totalCopies} نسخة\n`;
        report += `   - موعد التسليم: ${t.deadline || "غير محدد"}\n`;
        if (t.bindingType) report += `   - التشطيب: ${t.bindingType}\n`;
        if (t.notes) report += `   - ملاحظات: ${t.notes}\n`;
      });
    }

    report += `\n------------------------------------\nبالتوفيق لزملاء الشيفت القادم! 👍`;
    return report;
  };

  const copyHandoverReport = async () => {
    const text = generateHandoverReport();
    try {
      await navigator.clipboard.writeText(text);
      toast.success("تم النسخ", "تم نسخ تقرير الشيفت كاملاً بصيغة واتساب جاهزة");
    } catch {
      toast.error("خطأ", "تعذر نسخ التقرير");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <CheckSquare className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">مهام الطباعة وتسليم الشيفت (Tasks & Shift Handover)</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            إدارة أوردرات وملازم المدرسين والعملاء، عداد النسخ المطبوعة الحي، إرسال رسائل واتساب سريعة، وتوليد تقرير تسليم الشيفت بضغطة زر.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsHandoverModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition shadow-sm text-sm"
          >
            <FileText className="w-4 h-4" />
            تقرير تسليم الشيفت
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition shadow-md text-sm"
          >
            <Plus className="w-4 h-4" />
            أوردر طباعة جديد
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card/70 backdrop-blur-md p-4 rounded-2xl border border-border">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم العمل، العميل، الملاحظات..."
            className="w-full pr-9 pl-4 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl text-xs w-full sm:w-auto overflow-x-auto">
          {[
            { key: "all", label: "الكل" },
            { key: "active", label: "الطلبات الجارية" },
            { key: "pending", label: "في الانتظار" },
            { key: "in_progress", label: "جاري الطباعة" },
            { key: "ready", label: "جاهز للتسليم" },
            { key: "completed", label: "المكتملة" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="bg-card/40 border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground">
            <CheckSquare className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <p className="text-base font-medium">لا توجد طلبات تطابق هذا البحث</p>
            <p className="text-xs mt-1">أضف أوردرات جديدة أو غيّر خيارات التصفية</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const progress = Math.min(100, Math.round((task.completedCopies / task.totalCopies) * 100));
            const isDone = task.status === "completed";

            return (
              <div
                key={task.id}
                className={`group p-5 rounded-2xl border transition-all duration-200 bg-card/80 backdrop-blur-md shadow-xs ${
                  isDone
                    ? "opacity-60 border-border/40 bg-muted/20"
                    : task.status === "ready"
                    ? "border-emerald-500/40 hover:border-emerald-500"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Info Left */}
                  <div className="flex items-start gap-3.5 flex-1">
                    <button
                      onClick={() => handleToggleStatus(task.id)}
                      className={`mt-1 p-1 rounded-lg border transition ${
                        isDone
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-muted-foreground/40 hover:border-primary text-transparent"
                      }`}
                      title={isDone ? "تحديد كغير مكتمل" : "تحديد كمكتمل"}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>

                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={`font-bold text-base text-foreground ${
                            isDone ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {task.title}
                        </h3>

                        {/* Status Badge */}
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            task.status === "completed"
                              ? "bg-muted text-muted-foreground"
                              : task.status === "ready"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : task.status === "in_progress"
                              ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {task.status === "completed"
                            ? "مكتمل ومسلّم"
                            : task.status === "ready"
                            ? "جاهز للتسليم"
                            : task.status === "in_progress"
                            ? "جاري الطباعة"
                            : "في قائمة الانتظار"}
                        </span>

                        {task.deadline && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg">
                            <Clock className="w-3 h-3" />
                            الموعد: {task.deadline}
                          </span>
                        )}
                      </div>

                      {/* Customer & Specs */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">العميل / الأستاذ: {task.customerName}</span>

                        {task.phone && (
                          <span className="flex items-center gap-1" dir="ltr">
                            <Phone className="w-3 h-3 text-primary" />
                            {task.phone}
                          </span>
                        )}

                        {task.bindingType && (
                          <span className="bg-primary/5 text-primary px-2 py-0.5 rounded-md font-medium">
                            التجليد: {task.bindingType}
                          </span>
                        )}
                      </div>

                      {task.notes && (
                        <p className="text-xs text-muted-foreground/90 bg-muted/30 p-2 rounded-lg border border-border/40 inline-block mt-1">
                          ملاحظات: {task.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Counter & Controls Right */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-border">
                    {/* Live Copies Counter */}
                    <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-xl border border-border">
                      <button
                        onClick={() => handleUpdateCopies(task.id, -1)}
                        disabled={task.completedCopies <= 0}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background hover:bg-muted font-bold text-foreground disabled:opacity-30 transition text-sm shadow-xs"
                        title="طرح نسخة (-1)"
                      >
                        -1
                      </button>

                      <div className="text-center px-2 min-w-[90px]">
                        <div className="text-sm font-bold text-foreground">
                          {task.completedCopies} / {task.totalCopies}
                        </div>
                        <div className="text-[10px] text-muted-foreground">نسخة مطبوعة</div>
                      </div>

                      <button
                        onClick={() => handleUpdateCopies(task.id, 1)}
                        disabled={task.completedCopies >= task.totalCopies}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background hover:bg-muted font-bold text-foreground disabled:opacity-30 transition text-sm shadow-xs"
                        title="إضافة نسخة (+1)"
                      >
                        +1
                      </button>

                      <button
                        onClick={() => handleUpdateCopies(task.id, 5)}
                        disabled={task.completedCopies >= task.totalCopies}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 hover:bg-primary/20 font-bold text-primary disabled:opacity-30 transition text-xs shadow-xs"
                        title="إضافة 5 نسخ (+5)"
                      >
                        +5
                      </button>
                    </div>

                    {/* Quick WhatsApp button */}
                    {task.phone && (
                      <button
                        onClick={() => handleWhatsAppChat(task.phone || "", task.title, task.customerName)}
                        className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
                        title="مراسلة العميل واتساب"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        واتساب
                      </button>
                    )}

                    {/* Edit & Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(task)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition"
                        title="تعديل الأوردر"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition"
                        title="حذف الأوردر"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3.5 pt-2 border-t border-border/30">
                  <div className="flex justify-between items-center text-[11px] text-muted-foreground mb-1">
                    <span>نسبة إنجاز الطباعة</span>
                    <span className="font-semibold">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        progress === 100
                          ? "bg-emerald-500"
                          : progress > 50
                          ? "bg-blue-500"
                          : "bg-primary"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                {editingTask ? "تعديل أوردر الطباعة" : "إضافة أوردر طباعة جديد"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">عنوان المذكرة أو الأوردر *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: مذكرة أحياء ثانوية عامة - الفصل الأول"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">اسم العميل / الأستاذ *</label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    placeholder="أ/ أحمد إبراهيم"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">رقم الهاتف (للواتساب)</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">إجمالي النسخ المطلوبة</label>
                  <input
                    type="number"
                    min="1"
                    value={formTotalCopies}
                    onChange={(e) => setFormTotalCopies(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">النسخ المنجزة حالياً</label>
                  <input
                    type="number"
                    min="0"
                    max={formTotalCopies}
                    value={formCompletedCopies}
                    onChange={(e) => setFormCompletedCopies(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">موعد التسليم</label>
                  <input
                    type="text"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    placeholder="اليوم 5 م أو غداً"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">نوع التجليد والتشطيب</label>
                  <input
                    type="text"
                    value={formBindingType}
                    onChange={(e) => setFormBindingType(e.target.value)}
                    placeholder="سلك، بلاستيك، كعب حراري..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">الحالة</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as PrintTask["status"])}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="pending">في الانتظار</option>
                    <option value="in_progress">جاري الطباعة</option>
                    <option value="ready">جاهز للتسليم</option>
                    <option value="completed">مكتمل ومسلّم</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">ملاحظات ومواصفات إضافية</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="ملاحظات الورق، الألوان، تعليمات العميل..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition shadow-md"
                >
                  حفظ الأوردر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Handover Report Modal */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-bold text-foreground">تقرير تسليم واستلام الشيفت</h2>
              </div>
              <button
                onClick={() => setIsHandoverModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <p className="text-xs text-muted-foreground">
                ملخص جاهز لجميع الطلبات الحالية والمكتملة لنسخه ومشاركته مع زميل الشيفت التالي عبر الواتساب:
              </p>

              <pre className="p-4 bg-muted/30 border border-border rounded-xl text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                {generateHandoverReport()}
              </pre>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
              <span className="text-xs text-muted-foreground">
                إجمالي المهام المسجلة: {tasks.length} مهمة
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsHandoverModalOpen(false)}
                  className="px-4 py-2 text-xs text-muted-foreground hover:bg-muted rounded-xl transition"
                >
                  إغلاق
                </button>
                <button
                  onClick={copyHandoverReport}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition shadow-sm"
                >
                  <Copy className="w-4 h-4" />
                  نسخ التقرير للواتساب
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
