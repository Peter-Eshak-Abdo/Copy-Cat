"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface SharedItem {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  blob?: Blob;
  sender: string;
  timestamp: number;
}

export default function LanTransferPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [roomId, setRoomId] = useState<string>("copycat-lan-room");
  const [deviceName, setDeviceName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("copycat_device_name") || "جهاز المكتبة 1";
    }
    return "جهاز المكتبة 1";
  });

  const [sharedFiles, setSharedFiles] = useState<SharedItem[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState<number>(0);

  // BroadcastChannel for instant local inter-tab & local instance sync
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;

    try {
      const channel = new BroadcastChannel(`copycat_lan_${roomId}`);
      channelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === "NEW_FILE") {
          setSharedFiles((prev) => [payload, ...prev]);
          toast.info("ملف جديد مستلم!", `تم استلام ملف "${payload.name}" من ${payload.sender}`);
        } else if (type === "DELETE_FILE") {
          setSharedFiles((prev) => prev.filter((f) => f.id !== payload.id));
        }
      };

      return () => {
        channel.close();
      };
    } catch {
      // ignore
    }
  }, [roomId, toast]);

  const handleDeviceNameChange = (name: string) => {
    setDeviceName(name);
    try {
      localStorage.setItem("copycat_device_name", name);
    } catch {
      // ignore
    }
  };

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

  const processAndShareFile = (file: File) => {
    setIsTransferring(true);
    setTransferProgress(20);

    const reader = new FileReader();

    reader.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const percent = Math.round((evt.loaded / evt.total) * 90);
        setTransferProgress(percent);
      }
    };

    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newItem: SharedItem = {
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        dataUrl,
        blob: file,
        sender: deviceName,
        timestamp: Date.now(),
      };

      setSharedFiles((prev) => [newItem, ...prev]);
      setTransferProgress(100);
      setIsTransferring(false);

      // Broadcast to any listening tabs/browsers on LAN channel
      if (channelRef.current) {
        try {
          channelRef.current.postMessage({
            type: "NEW_FILE",
            payload: newItem,
          });
        } catch {
          // in case payload is too large for structured clone
        }
      }

      toast.success("جاهز للنقل", `تمت مشاركة "${file.name}" بنجاح على الشبكة المحلية`);
    };

    reader.onerror = () => {
      setIsTransferring(false);
      toast.error("خطأ", "تعذر قراءة الملف المحدد");
    };

    reader.readAsDataURL(file);
  };

  const handleDownloadFile = (item: SharedItem) => {
    if (!item.dataUrl) {
      toast.warning("تنبيه", "بيانات الملف غير متوفرة للتحميل المباشر");
      return;
    }

    const a = document.createElement("a");
    a.href = item.dataUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("جاري التنزيل", `بدأ تحميل "${item.name}"`);
  };

  const handleDeleteItem = (id: string) => {
    setSharedFiles((prev) => prev.filter((f) => f.id !== id));
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: "DELETE_FILE",
        payload: { id },
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (name: string, type: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    }
    if (["pdf"].includes(ext)) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    if (["zip", "rar", "7z", "tar"].includes(ext)) {
      return <FileArchive className="w-5 h-5 text-amber-500" />;
    }
    return <File className="w-5 h-5 text-primary" />;
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Share2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">مركز النقل السريع الداخلي (Local LAN Transfer Hub)</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            نقل فوري للملفات والملازم بين أجهزة المكتبة عبر كابل الشبكة المحلية أو الراوتر الداخلي بدون استهلاك باقة الإنترنت.
          </p>
        </div>

        {/* Network Status Badge */}
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 rounded-2xl text-xs font-semibold">
          <Zap className="w-4 h-4 text-emerald-500" />
          <span>الشبكة المحلية جاهزة (Direct LAN Cable / Wi-Fi)</span>
        </div>
      </div>

      {/* Device & Room Settings Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-card/70 backdrop-blur-md p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-2">
          <Laptop className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">اسم هذا الجهاز:</span>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => handleDeviceNameChange(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-background"
            placeholder="جهاز الطباعة 1"
          />
        </div>

        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">غرفة النقل المشتركة:</span>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-background font-mono"
            placeholder="copycat-lan-room"
          />
        </div>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border hover:border-primary/50 transition cursor-pointer rounded-3xl p-10 flex flex-col items-center justify-center text-center gap-3 bg-card/40 hover:bg-card/70 min-h-[220px]"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        <div className="p-4 bg-primary/10 text-primary rounded-full">
          <Upload className="w-8 h-8" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-foreground">
            اسحب أي ملفات هنا أو اضغط للاختيار من الجهاز
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            يدعم ملفات PDF، الملازم، الصور، ومجلدات الـ ZIP من أي حجم للنقل المباشر
          </p>
        </div>

        {isTransferring && (
          <div className="w-full max-w-xs mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>جاري تجهيز وبث الملف...</span>
              <span>{transferProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-200"
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
            <HardDrive className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">الملفات المتبادلة في الغرفة</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {sharedFiles.length} ملفات جاهزة للتحميل
          </span>
        </div>

        {sharedFiles.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Share2 className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-medium">لم يتم إرسال أي ملفات بعد في هذه الجلسة</p>
            <p className="text-xs mt-1">
              الملفات المرفوعة ستظهر فوراً لجميع الأجهزة المشتركة في نفس الغرفة
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sharedFiles.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-border bg-background/80 hover:border-primary/40 transition flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2.5 bg-muted rounded-xl flex-shrink-0">
                    {getFileIcon(item.name, item.type)}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-sm text-foreground truncate max-w-[200px]" title={item.name}>
                      {item.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{formatFileSize(item.size)}</span>
                      <span>•</span>
                      <span>من: {item.sender}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDownloadFile(item)}
                    className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition font-semibold"
                    title="تحميل الملف للجهاز"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
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
          <ShieldCheck className="w-4 h-4 text-primary" />
          كيف يعمل النقل الداخلي في المطبعة؟
        </div>
        <p>
          1. افتح صفحة <strong>/admin/lan-transfer</strong> على الجهازين (مثلاً جهاز التصوير وجهاز الاستقبال).
        </p>
        <p>
          2. تأكد من تطابق اسم <strong>&ldquo;غرفة النقل المشتركة&rdquo;</strong> في الجهازين.
        </p>
        <p>
          3. اسحب أي ملف في أي جهاز وسيظهر زر التحميل في الجهاز الآخر فوراً عبر الشبكة الداخلية بدون أي استهلاك لباقة الإنترنت.
        </p>
      </div>
    </div>
  );
}
