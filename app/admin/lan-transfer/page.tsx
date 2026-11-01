"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Share2,
  Upload,
  Download,
  Laptop,
  Trash2,
  HardDrive,
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
      toast.success("اسم الجهاز اتغير", `الاسم الجديد: ${newName}`);
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
        throw new Error(errJson.error || "الملف متبعتش.");
      }

      const data = await res.json();
      if (data.success && data.file) {
        setSharedFiles((prev) => [data.file, ...prev.filter((f) => f.id !== data.file.id)]);
        setTransferProgress(100);
        toast.success("الملف اتبعت 🚀", `"${file.name}" بقى موجود على كل أجهزة المكتبة.`);
        void fetchSharedFiles();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "الملف متبعتش";
      toast.error("الملف متبعتش", msg);
    } finally {
      setIsTransferring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadFile = (item: SharedItem) => {
    if (!item.downloadUrl) {
      toast.warning("مش لاقيين الملف", "رابط التحميل مش موجود");
      return;
    }

    const a = document.createElement("a");
    a.href = item.downloadUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("بننزل الملف", `"${item.name}"...`);
  };

  const handleDeleteItem = async (id: string) => {
    try {
      setSharedFiles((prev) => prev.filter((f) => f.id !== id));
      const res = await fetch(`/api/admin/lan-transfer?id=${encodeURIComponent(id)}&roomId=${encodeURIComponent(roomId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("اتمسح", "الملف اتمسح من على كل الأجهزة.");
      }
    } catch {
      toast.error("متمسحش", "الملف متمسحش، جرب تاني.");
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
        notes: `اتبعت من جهاز "${item.sender}". الحجم: ${formatFileSize(item.size)}`,
        status: "pending" as const,
        createdAt: now,
      };
      localStorage.setItem("copycat_tasks_v1", JSON.stringify([newTask, ...existing]));
      toast.success("اتضاف لشغل الطباعة 🖨️", `"${item.name}" اتضاف في صفحة الأوردرات.`);
    } catch (err) {
      console.error(err);
      toast.error("الأوردر متحفظش", "جرب تاني.");
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
    <div className="space-y-5" dir="rtl">
      {/* Device & Room Settings Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Device Name with Random Generator Button */}
        <div className="flex items-center gap-2">
          <Laptop className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">اسم الجهاز:</span>
          <div className="flex-1 flex items-center gap-1.5">
            <input
              type="text"
              suppressHydrationWarning
              value={deviceName}
              onChange={(e) => handleDeviceNameChange(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none transition"
              placeholder="اسم الجهاز..."
            />
            <button
              type="button"
              onClick={regenerateDeviceName}
              title="اسم جديد"
              className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition cursor-pointer shrink-0 flex items-center gap-1 text-[11px] font-bold"
            >
              <Dices className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">اسم جديد</span>
            </button>
          </div>
        </div>

        {/* Shared Room Input with Manual Refresh */}
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">الأوضة:</span>
          <div className="flex-1 flex items-center gap-1.5">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono focus:border-blue-500 focus:bg-white focus:outline-none transition"
              placeholder="copycat-lan-room"
            />
            <button
              type="button"
              onClick={() => fetchSharedFiles()}
              disabled={isRefreshing}
              title="حدّث"
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Modern Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-200 hover:border-blue-500 transition cursor-pointer rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-2 bg-white hover:bg-blue-50/20 min-h-[160px] shadow-xs"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <Upload className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-900">
            اسحب أي ملفات وسيبها هنا، أو دوس واختارها
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            الملفات بتروح على طول لكل أجهزة المكتبة اللي على نفس الراوتر
          </p>
        </div>

        {isTransferring && (
          <div className="w-full max-w-xs mt-2 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 text-blue-600 font-bold">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>بنبعت...</span>
              </span>
              <span className="font-mono">{transferProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className="h-full bg-linear-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-200"
                style={{ width: `${transferProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Shared Files List */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900">الملفات اللي اتبعتت</h2>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl">
            {sharedFiles.length} {sharedFiles.length === 1 ? "ملف" : "ملفات"}
          </span>
        </div>

        {sharedFiles.length === 0 ? (
          <div className="py-8 text-center text-slate-600">
            <Share2 className="w-8 h-8 mx-auto opacity-30 mb-2" />
            <p className="text-xs font-bold">لسه مفيش ملفات</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sharedFiles.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-white border border-slate-200 rounded-xl shrink-0 shadow-2xs">
                    {getFileIcon(item.name, item.type)}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-xs text-slate-900 truncate max-w-[200px]" title={item.name}>
                      {item.name}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-0.5">
                      <span className="font-mono">{formatFileSize(item.size)}</span>
                      <span>•</span>
                      <span className="text-blue-600 font-semibold truncate max-w-[120px]">{item.sender}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleSendToPrintQueue(item)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer border border-emerald-200"
                    title="ضيفه لشغل الطباعة"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">اطبع</span>
                  </button>

                  <button
                    onClick={() => handleDownloadFile(item)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-xs"
                    title="نزّل الملف"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>نزّل</span>
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-600 hover:text-red-600 transition cursor-pointer"
                    title="امسح"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
