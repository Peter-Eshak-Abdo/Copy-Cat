"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CreditCard,
  Plus,
  CheckCircle2,
  Clock,
  Search,
  Trash2,
  MessageCircle,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  X,
  AlertCircle,
  FileText,
  UserCheck,
  Smartphone,
  Copy,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { useAuth } from "@/lib/auth";

export interface InstaPayRecord {
  id: string;
  customerName: string;
  phone: string;
  amount: number;
  senderAccount?: string;
  notes?: string;
  timestamp: number;
  status: "pending" | "confirmed";
  confirmedAt?: number;
  confirmedBy?: string;
}

const INSTAPAY_STORAGE_KEY = "copycat_instapay_v1";

export function getInstaPaySnapshot(): InstaPayRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(INSTAPAY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveInstaPayRecords(records: InstaPayRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INSTAPAY_STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

export default function InstaPayAdminPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [records, setRecords] = useState<InstaPayRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "confirmed">("pending");

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [senderAccount, setSenderAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [isAddingModal, setIsAddingModal] = useState(false);

  // Load records
  useEffect(() => {
    setRecords(getInstaPaySnapshot());

    const handleStorageChange = () => {
      setRecords(getInstaPaySnapshot());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Submit new transfer
  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error("بيانات ناقصة", "يرجى كتابة اسم العميل.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("مبلغ غير صحيح", "يرجى كتابة مبلغ التحويل بالجنيه.");
      return;
    }

    const newRecord: InstaPayRecord = {
      id: `INSTA-${Date.now().toString().slice(-6)}`,
      customerName: customerName.trim(),
      phone: phone.trim(),
      amount: Number(amount),
      senderAccount: senderAccount.trim() || undefined,
      notes: notes.trim() || undefined,
      timestamp: Date.now(),
      status: "pending",
    };

    const updated = [newRecord, ...records];
    setRecords(updated);
    saveInstaPayRecords(updated);

    toast.success("تم تسجيل التحويل بنجاح!", `تحويل ${newRecord.amount} ج.م مسجل كمعلق حتى يؤكده الباشمهندس.`);
    setIsAddingModal(false);
    resetForm();
  };

  const resetForm = () => {
    setCustomerName("");
    setPhone("");
    setAmount("");
    setSenderAccount("");
    setNotes("");
  };

  // Confirm a payment (Done by the Engineer)
  const handleConfirmRecord = (id: string) => {
    const engineerName = user?.name || "الباشمهندس";
    const updated = records.map((rec) => {
      if (rec.id === id) {
        return {
          ...rec,
          status: "confirmed" as const,
          confirmedAt: Date.now(),
          confirmedBy: engineerName,
        };
      }
      return rec;
    });

    setRecords(updated);
    saveInstaPayRecords(updated);
    toast.success("تم تأكيد الاستلام بنجاح ✓", `تم التحقق من استلام المبلغ بحساب إنستا باي بواسطة: ${engineerName}`);
  };

  // Delete a record
  const handleDeleteRecord = (id: string, name: string) => {
    if (!confirm(`هل تريد حذف عملية تحويل "${name}"؟`)) return;
    const updated = records.filter((r) => r.id !== id);
    setRecords(updated);
    saveInstaPayRecords(updated);
    toast.info("تم الحذف", "تمت إزالة المعاملة من السجل.");
  };

  // Metrics
  const pendingRecords = useMemo(() => records.filter((r) => r.status === "pending"), [records]);
  const confirmedRecords = useMemo(() => records.filter((r) => r.status === "confirmed"), [records]);

  const totalPendingAmount = useMemo(
    () => pendingRecords.reduce((sum, r) => sum + (r.amount || 0), 0),
    [pendingRecords]
  );
  const totalConfirmedAmount = useMemo(
    () => confirmedRecords.reduce((sum, r) => sum + (r.amount || 0), 0),
    [confirmedRecords]
  );

  // Filtered List
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (filterStatus === "pending" && rec.status !== "pending") return false;
      if (filterStatus === "confirmed" && rec.status !== "confirmed") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = rec.customerName.toLowerCase().includes(q);
        const matchPhone = rec.phone.includes(q);
        const matchNotes = rec.notes?.toLowerCase().includes(q);
        const matchSender = rec.senderAccount?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchNotes && !matchSender) return false;
      }

      return true;
    });
  }, [records, filterStatus, searchQuery]);

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface p-space-md sm:p-space-xl">
      <div className="max-w-7xl mx-auto mb-space-lg">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md pb-space-md border-b border-surface-container-high/40">
          <div>
            <div className="flex items-center gap-space-xs text-primary font-label-code text-label-code mb-1">
              <Link href="/admin" className="hover:underline flex items-center gap-1">
                لوحة التحكم
              </Link>
              <span>/</span>
              <span>سجل مدفوعات إنستا باي</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg font-bold flex items-center gap-space-xs">
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <CreditCard className="w-6 h-6" />
              </span>
              <span>سجل مدفوعات إنستا باي (InstaPay Tracker)</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              تسجيل فوري لأي عميل يدفع عبر إنستا باي لحين وصول الباشمهندس ومراجعة تطبيق البنك وتأكيد الاستلام.
            </p>
          </div>

          <div className="flex items-center gap-space-xs">
            <button
              onClick={() => setIsAddingModal(true)}
              className="flex items-center gap-2 px-space-md py-space-sm rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>تسجيل تحويل إنستا باي جديد</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md mt-space-md">
          {/* Pending Card */}
          <div className="p-space-md rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <div>
              <span className="text-body-xs font-label-code text-amber-400 font-bold block">
                تحويلات معلقة (بانتظار التأكيد)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-headline-lg font-extrabold text-amber-300">
                  {totalPendingAmount.toLocaleString("ar-EG")}
                </span>
                <span className="text-body-sm font-bold text-amber-400">ج.م</span>
              </div>
              <span className="text-body-xs text-amber-400/80 mt-1 block">
                {pendingRecords.length} عمليات دفع بانتظار مراجعة الباشمهندس
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          {/* Confirmed Card */}
          <div className="p-space-md rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <span className="text-body-xs font-label-code text-emerald-400 font-bold block">
                تحويلات تم تأكيدها واستلامها
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-headline-lg font-extrabold text-emerald-300">
                  {totalConfirmedAmount.toLocaleString("ar-EG")}
                </span>
                <span className="text-body-sm font-bold text-emerald-400">ج.م</span>
              </div>
              <span className="text-body-xs text-emerald-400/80 mt-1 block">
                {confirmedRecords.length} عمليات مؤكدة في حساب المكتبة
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          {/* Total Transactions */}
          <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container-high/40 flex items-center justify-between">
            <div>
              <span className="text-body-xs font-label-code text-on-surface-variant block">
                إجمالي تحويلات إنستا باي المسجلة
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-headline-lg font-extrabold text-purple-400">
                  {(totalPendingAmount + totalConfirmedAmount).toLocaleString("ar-EG")}
                </span>
                <span className="text-body-sm font-bold text-on-surface-variant">ج.م</span>
              </div>
              <span className="text-body-xs text-on-surface-variant mt-1 block">
                إجمالي {records.length} معاملة اليوم
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mt-space-md p-space-sm rounded-xl bg-surface-container-low border border-surface-container-high/40">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterStatus("pending")}
              className={`px-space-md py-1.5 rounded-lg text-body-sm font-bold transition-all cursor-pointer ${
                filterStatus === "pending"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface"
              }`}
            >
              ⚠️ المعلقة فقط ({pendingRecords.length})
            </button>
            <button
              onClick={() => setFilterStatus("confirmed")}
              className={`px-space-md py-1.5 rounded-lg text-body-sm font-bold transition-all cursor-pointer ${
                filterStatus === "confirmed"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface"
              }`}
            >
              ✓ المؤكدة ({confirmedRecords.length})
            </button>
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-space-md py-1.5 rounded-lg text-body-sm font-bold transition-all cursor-pointer ${
                filterStatus === "all"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface"
              }`}
            >
              الكل ({records.length})
            </button>
          </div>

          <div className="relative min-w-[280px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="بحث باسم العميل، الهاتف، أو المبلغ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-1.5 text-body-sm bg-surface-container border border-surface-container-high rounded-xl text-on-surface focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="max-w-7xl mx-auto">
        {filteredRecords.length === 0 ? (
          <div className="py-20 text-center rounded-2xl bg-surface-container-low border border-surface-container-high/40 p-space-xl">
            <AlertCircle className="w-12 h-12 text-on-surface-variant mx-auto mb-space-sm opacity-50" />
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">لا توجد تحويلات مسجلة</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {filterStatus === "pending"
                ? "ممتاز! لا توجد أي تحويلات إنستا باي معلقة بانتظار التأكيد حالياً."
                : "لم يتم العثور على أي عمليات مسجلة."}
            </p>
            <button
              onClick={() => setIsAddingModal(true)}
              className="mt-space-md px-space-md py-space-sm rounded-xl bg-purple-600 text-white font-bold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل تحويل جديد</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-surface-container-low border border-surface-container-high/40 shadow-xl">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-label-code text-label-code">
                  <th className="p-space-sm">رقم العملية</th>
                  <th className="p-space-sm">اسم العميل</th>
                  <th className="p-space-sm">رقم الهاتف والتواصل</th>
                  <th className="p-space-sm">المبلغ</th>
                  <th className="p-space-sm">وقت الدفع</th>
                  <th className="p-space-sm">الحساب / ملاحظات</th>
                  <th className="p-space-sm text-center">حالة التأكيد</th>
                  <th className="p-space-sm text-left">إجراء الباشمهندس</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/30 font-body-sm text-body-sm">
                {filteredRecords.map((rec) => {
                  const isPending = rec.status === "pending";
                  const formattedDate = new Date(rec.timestamp).toLocaleTimeString("ar-EG", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={rec.id}
                      className={`hover:bg-surface-container/50 transition-colors ${
                        isPending ? "bg-amber-500/[0.03]" : ""
                      }`}
                    >
                      <td className="p-space-sm font-label-code text-label-code font-bold text-on-surface-variant">
                        {rec.id}
                      </td>

                      <td className="p-space-sm font-bold text-on-surface">
                        {rec.customerName}
                      </td>

                      <td className="p-space-sm">
                        {rec.phone ? (
                          <div className="flex items-center gap-2">
                            <span dir="ltr" className="font-mono text-xs">{rec.phone}</span>
                            <a
                              href={`https://wa.me/2${rec.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-500 hover:text-emerald-400 p-1 rounded"
                              title="مراسلة واتساب"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant text-xs">غير مسجل</span>
                        )}
                      </td>

                      <td className="p-space-sm">
                        <span className="font-bold text-base text-purple-400">
                          {rec.amount.toLocaleString("ar-EG")} ج.م
                        </span>
                      </td>

                      <td className="p-space-sm text-on-surface-variant text-xs">
                        {formattedDate}
                      </td>

                      <td className="p-space-sm text-xs text-on-surface-variant max-w-[200px] truncate">
                        {rec.senderAccount && <div className="font-semibold text-on-surface">{rec.senderAccount}</div>}
                        {rec.notes && <div className="text-on-surface-variant truncate">{rec.notes}</div>}
                        {!rec.senderAccount && !rec.notes && "—"}
                      </td>

                      <td className="p-space-sm text-center">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            <span>بانتظار التأكيد</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مؤكد ({rec.confirmedBy || "الباشمهندس"})</span>
                          </span>
                        )}
                      </td>

                      <td className="p-space-sm text-left">
                        <div className="flex items-center justify-end gap-2">
                          {isPending ? (
                            <button
                              onClick={() => handleConfirmRecord(rec.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                              title="تأكيد وصول المبلغ في الحساب"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              <span>تأكيد الاستلام ✓</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-400 font-medium">
                              تم التحقق
                            </span>
                          )}

                          <button
                            onClick={() => handleDeleteRecord(rec.id, rec.customerName)}
                            className="p-1.5 rounded-lg text-on-surface-variant hover:text-rose-500 hover:bg-surface-container transition cursor-pointer"
                            title="حذف السجل"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {isAddingModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-surface-container-high rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  تسجيل تحويل إنستا باي جديد
                </h3>
              </div>
              <button onClick={() => setIsAddingModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddRecord} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">اسم العميل:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أ. محمد إبراهيم"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-surface-container border border-surface-container-high rounded-xl p-2.5 text-sm text-on-surface focus:border-purple-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">المبلغ المحول (ج.م):</label>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="مثال: 150"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                  className="w-full bg-surface-container border border-surface-container-high rounded-xl p-2.5 text-sm font-bold text-purple-400 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">رقم هاتف العميل (للتأكيد ومراسلة واتساب):</label>
                <input
                  type="tel"
                  placeholder="مثال: 01212345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-surface-container border border-surface-container-high rounded-xl p-2.5 text-sm text-on-surface focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">اسم الحساب المحول منه / رقم العملية [اختياري]:</label>
                <input
                  type="text"
                  placeholder="مثال: تحويل من حساب InstaPay: ahmed@instapay"
                  value={senderAccount}
                  onChange={(e) => setSenderAccount(e.target.value)}
                  className="w-full bg-surface-container border border-surface-container-high rounded-xl p-2.5 text-sm text-on-surface focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1">ملاحظات إضافية:</label>
                <textarea
                  rows={2}
                  placeholder="نوع الطلب، أو ملاحظات خاصة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-surface-container border border-surface-container-high rounded-xl p-2.5 text-sm text-on-surface focus:border-purple-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingModal(false)}
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-surface-container hover:bg-surface-container-high text-on-surface transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition"
                >
                  حفظ التحويل (معلق)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
