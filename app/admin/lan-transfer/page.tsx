"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Share2,
  Upload,
  Download,
  Laptop,
  Trash2,
  HardDrive,
  Zap,
  ShieldCheck,
  FileText,
  FileArchive,
  Image as ImageIcon,
  File,
  RefreshCw,
  Dices,
  Loader2,
  Printer,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface SharedItem {
  id: string;
  name: string;
  size: number;
  type: string;
  sender: string;
  timestamp: number;
  downloadUrl: string;
}

// Generate fun and professional Arabic semi-random device names
export function generateRandomDeviceName(): string {
  const prefixes = ["حاسوب", "محطة", "جهاز", "منصة", "وحدة"];
  const titles = [
    "الصقر",
    "النسر",
    "الليزر",
    "البرق",
    "الفولاذ",
    "الصاروخ",
    "النمر",
    "الأسد",
    "الفهد",
    "الألماسي",
    "الذهبي",
    "السريع",
    "العملاق",
    "الشبح",
  ];
  const traits = ["سريع", "برق", "فولاذ", "صاروخ", "نمر", "ليزر", "صقر", "عملاق"];

  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const title = titles[Math.floor(Math.random() * titles.length)];
  const trait = traits[Math.floor(Math.random() * traits.length)];
  const num = Math.floor(100 + Math.random() * 900);

  return `${prefix} ${title} (${trait}-${num})`;
}

export default function LanTransferPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [roomId, setRoomId] = useState<string>("copycat-lan-room");
  const [deviceName, setDeviceName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("copycat_device_name");
        if (saved && saved.trim() && saved !== "جهاز المكتبة 1") {
          return saved;
        }
        const randomName = generateRandomDeviceName();
        localStorage.setItem("copycat_device_name", randomName);
        return randomName;
      } catch {}
    }
    return "";
  });

  const [sharedFiles, setSharedFiles] = useState<SharedItem[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleDeviceNameChange = (name: string) => {
    setDeviceName(name);
    try {
      localStorage.setItem("copycat_device_name", name);
    } catch {}
  };

  const regenerateDeviceName = () => {
    const newName = generateRandomDeviceName();
    setDeviceName(newName);
    try {
      localStorage.setItem("copycat_device_name", newName);
      toast.success("تم تجديد اسم الجهاز", `الاسم الجديد: ${newName}`);
    } catch {}
  };

  // Fetch shared files from the LAN server (for manual button refresh)
  const fetchSharedFiles = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/admin/lan-transfer?roomId=${encodeURIComponent(roomId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.files)) {
          setSharedFiles(data.files);
        }
      }
    } catch (err) {
      console.warn("LAN fetch sync error:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [roomId]);

  // Periodic polling every 2 seconds to keep devices in sync over LAN
  useEffect(() => {
    let ignore = false;

    const syncFiles = async () => {
      try {
        const res = await fetch(`/api/admin/lan-transfer?roomId=${encodeURIComponent(roomId)}`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.success && Array.isArray(data.files)) {
            setSharedFiles(data.files);
          }
        }
      } catch (err) {
        console.warn("LAN fetch sync error:", err);
      }
    };

    void syncFiles();
    const interval = setInterval(() => {
      void syncFiles();
    }, 2000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [roomId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      processAndShareFile(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file) => {
        processAndShareFile(file);
      });
    }
  };

  const processAndShareFile = async (file: File) => {
    setIsTransferring(true);
    setTransferProgress(25);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sender", deviceName || "جهاز غير معروف");
      formData.append("roomId", roomId);

      setTransferProgress(50);

      const res = await fetch("/api/admin/lan-transfer", {
        method: "POST",
        body: formData,
      });

      setTransferProgress(85);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "تعذر رفع الملف إلى شبكة المكتبة.");
      }

      const data = await res.json();
      if (data.success && data.file) {
        setSharedFiles((prev) => [data.file, ...prev.filter((f) => f.id !== data.file.id)]);
        setTransferProgress(100);
        toast.success("تم الإرسال على الشبكة 🚀", `الملف "${file.name}" متاح الآن للتحميل على أجهزة المكتبة.`);
        void fetchSharedFiles();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل نقل الملف عبر الشبكة";
      toast.error("خطأ في النقل", msg);
    } finally {
      setIsTransferring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadFile = (item: SharedItem) => {
    if (!item.downloadUrl) {
      toast.warning("تنبيه", "رابط تحميل الملف غير متوفر");
      return;
    }

    const a = document.createElement("a");
    a.href = item.downloadUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("بدء التحميل", `جاري تنزيل "${item.name}"...`);
  };

  const handleDeleteItem = async (id: string) => {
    try {
      setSharedFiles((prev) => prev.filter((f) => f.id !== id));
      const res = await fetch(`/api/admin/lan-transfer?id=${encodeURIComponent(id)}&roomId=${encodeURIComponent(roomId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("تم الحذف", "تم حذف الملف من غرفة النقل المشتركة.");
      }
    } catch {
      toast.error("خطأ", "تعذر حذف الملف من الخادم.");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSendToPrintQueue = useCallback((item: SharedItem) => {
    try {
      const raw = localStorage.getItem("copycat_tasks_v1");
      const existing = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const newTask = {
        id: `task-${now}-${Math.random().toString(36).substring(2, 6)}`,
        title: `طباعة: ${item.name}`,
        customerName: item.sender || "شبكة المكتبة",
        phone: "",
        deadline: new Date(now + 30 * 60 * 1000).toTimeString().slice(0, 5),
        totalCopies: 1,
        completedCopies: 0,
        bindingType: "عادي",
        notes: `أُرسل عبر سلك الشبكة / LAN من "${item.sender}". الحجم: ${formatFileSize(item.size)}`,
        status: "pending" as const,
        createdAt: now,
      };
      localStorage.setItem("copycat_tasks_v1", JSON.stringify([newTask, ...existing]));
      toast.success("أُرسل لطابور الطباعة 🖨️", `تم تسجيل مهمة طباعة "${item.name}" في جدول مهام التسليم (/admin/tasks).`);
    } catch (err) {
      console.error(err);
      toast.error("خطأ", "تعذر تسجيل المهمة في طابور الطباعة.");
    }
  }, [toast]);

  const getFileIcon = (name: string, type: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (type?.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    }
    if (["pdf"].includes(ext)) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    if (["zip", "rar", "7z", "tar"].includes(ext)) {
      return <FileArchive className="w-5 h-5 text-amber-500" />;
    }
    return <File className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
              <Share2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">مركز النقل السريع الداخلي (Local LAN Transfer Hub)</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            نقل فوري وسريع للملفات والملازم بين أجهزة المكتبة عبر كابل الشبكة المحلية أو الراوتر الداخلي بدون استهلاك باقة الإنترنت.
          </p>
        </div>

        {/* Network Status Badge */}
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 rounded-2xl text-xs font-semibold">
          <Zap className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span>الشبكة المحلية متصلة (LAN Cable / Wi-Fi Sync)</span>
        </div>
      </div>

      {/* Device & Room Settings Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-card/70 backdrop-blur-md p-4 rounded-2xl border border-border">
        {/* Device Name with Random Generator Button */}
        <div className="flex items-center gap-2">
          <Laptop className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">اسم هذا الجهاز:</span>
          <div className="flex-1 flex items-center gap-1.5">
            <input
              type="text"
              suppressHydrationWarning
              value={deviceName}
              onChange={(e) => handleDeviceNameChange(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:border-blue-500 focus:outline-none"
              placeholder="مثال: حاسوب الصقر (سريع-742)"
            />
            <button
              type="button"
              onClick={regenerateDeviceName}
              title="توليد اسم شبه عشوائي جديد بنظام مميز"
              className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition cursor-pointer shrink-0 flex items-center gap-1 text-[11px] font-bold"
            >
              <Dices className="w-4 h-4" />
              <span className="hidden sm:inline">اسم عشوائي</span>
            </button>
          </div>
        </div>

        {/* Shared Room Input with Manual Refresh */}
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">غرفة النقل المشتركة:</span>
          <div className="flex-1 flex items-center gap-1.5">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-background font-mono focus:border-blue-500 focus:outline-none"
              placeholder="copycat-lan-room"
            />
            <button
              type="button"
              onClick={() => fetchSharedFiles()}
              disabled={isRefreshing}
              title="تحديث قائمة الملفات يدوياً"
              className="p-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-slate-700 dark:text-slate-300 transition cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border hover:border-blue-500/60 transition cursor-pointer rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-3 bg-card/40 hover:bg-card/70 min-h-[220px]"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        <div className="p-4 bg-blue-500/10 text-blue-500 rounded-full">
          <Upload className="w-8 h-8" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-foreground">
            اسحب أي ملفات هنا أو اضغط للاختيار من الجهاز
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            يدعم ملفات PDF، الملازم، الصور، ومجلدات الـ ZIP من أي حجم للنقل المباشر عبر السيرفر الداخلي
          </p>
        </div>

        {isTransferring && (
          <div className="w-full max-w-xs mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 text-blue-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري بث الملف عبر الشبكة...</span>
              </span>
              <span>{transferProgress}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-blue-500 to-cyan-400 transition-all duration-200"
                style={{ width: `${transferProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Shared Files List */}
      <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-foreground">الملفات المتبادلة في الغرفة</h2>
            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              مزامنة تلقائية كل 2 ثانية
            </span>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {sharedFiles.length} ملفات جاهزة للتحميل
          </span>
        </div>

        {sharedFiles.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Share2 className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-medium">لم يتم إرسال أي ملفات بعد في هذه الغرفة</p>
            <p className="text-xs mt-1 text-slate-400">
              الملفات المرفوعة ستظهر فوراً وبشكل تلقائي لجميع الأجهزة المشتركة في نفس الغرفة عبر الشبكة الداخلية.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sharedFiles.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-border bg-background/80 hover:border-blue-500/40 transition flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2.5 bg-muted rounded-xl shrink-0">
                    {getFileIcon(item.name, item.type)}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-sm text-foreground truncate max-w-[200px]" title={item.name}>
                      {item.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{formatFileSize(item.size)}</span>
                      <span>•</span>
                      <span className="text-blue-500 font-semibold truncate max-w-[130px]">من: {item.sender}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleSendToPrintQueue(item)}
                    className="px-2.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    title="إرسال لطابور مهام الطباعة والتسليم"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">طابور الطباعة</span>
                  </button>

                  <button
                    onClick={() => handleDownloadFile(item)}
                    className="px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    title="تحميل الملف للجهاز"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل</span>
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition cursor-pointer"
                    title="حذف من الغرفة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions / LAN Setup Tips */}
      <div className="p-4 bg-muted/30 border border-border rounded-2xl text-xs text-muted-foreground space-y-2">
        <div className="font-semibold text-foreground flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          كيف يعمل النقل الداخلي عبر سلك الشبكة / الروتر في المكتبة؟
        </div>
        <p>
          1. افتح صفحة <strong>/admin/lan-transfer</strong> على الجهازين (مثلاً جهاز التصوير وجهاز الاستقبال) المتصلين بالراوتر بكابل LAN أو واي فاي.
        </p>
        <p>
          2. تأكد من تطابق اسم <strong>&ldquo;غرفة النقل المشتركة&rdquo;</strong> في الجهازين (الافتراضي: copycat-lan-room).
        </p>
        <p>
          3. اسحب أي ملف في أي جهاز؛ سيتم رفعه فورا لمخدم المكتبة المحلي، وسيظهر زر <strong>&ldquo;تحميل&rdquo;</strong> في الجهاز الآخر خلال ثانيتين دون استهلاك باقة الإنترنت إطلاقاً!
        </p>
      </div>
    </div>
  );
}
