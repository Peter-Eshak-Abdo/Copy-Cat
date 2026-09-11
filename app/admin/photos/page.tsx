"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Camera,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Link2,
  RefreshCw,
  X,
  Sparkles,
  Eye,
  PackageCheck,
  Check,
  Loader2,
  Wand2,
  Sliders,
  Bot,
  Lightbulb,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { INITIAL_PRODUCTS, type InventoryItem, sanitizeItem } from "@/lib/inventory";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { enhanceProductPhotoCanvas, ProductEnhanceOptions } from "@/lib/product-enhancer";

interface PoolPhoto {
  id: string;
  filename: string;
  url: string;
  sizeBytes: number;
  createdAt: number;
  source: "facebook" | "upload";
}

interface PhotoLinkInfo {
  productId: number;
  productName: string;
  category: string;
  isPrimary: boolean;
}

export default function PhotoPoolPage() {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<PoolPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unassigned" | "assigned">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "facebook" | "upload">("all");

  // Catalog items for linking
  const [catalogItems, setCatalogItems] = useState<InventoryItem[]>(INITIAL_PRODUCTS);

  // Link map: photo.url -> PhotoLinkInfo
  const [linkMap, setLinkMap] = useState<Record<string, PhotoLinkInfo>>({});

  // Modals state
  const [previewPhoto, setPreviewPhoto] = useState<PoolPhoto | null>(null);
  const [assigningPhoto, setAssigningPhoto] = useState<PoolPhoto | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [linkAsPrimary, setLinkAsPrimary] = useState(true);

  // AI Product Enhancer & Gemini Analysis State
  const [enhancingPhoto, setEnhancingPhoto] = useState<PoolPhoto | null>(null);
  const [enhancedPreviewUrl, setEnhancedPreviewUrl] = useState<string | null>(null);
  const [isEnhancingProcess, setIsEnhancingProcess] = useState(false);
  const [enhancerOptions, setEnhancerOptions] = useState<ProductEnhanceOptions>({
    whiteBalance: true,
    vibranceBoost: 35,
    contrastBoost: 25,
    sharpness: 45,
    brightnessDelta: 8,
    clarifyLabels: true,
  });
  const [geminiAnalysis, setGeminiAnalysis] = useState<{
    suggestedTitle: string;
    category: string;
    description: string;
    aiAdvice: string;
  } | null>(null);

  // File input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyCanvasEnhance = (photoUrl: string, opts = enhancerOptions) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = photoUrl;
    img.onload = () => {
      const res = enhanceProductPhotoCanvas(img, opts);
      setEnhancedPreviewUrl(res);
    };
  };

  const openEnhancerModal = (photo: PoolPhoto) => {
    setEnhancingPhoto(photo);
    setGeminiAnalysis(null);
    setIsEnhancingProcess(false);
    applyCanvasEnhance(photo.url, enhancerOptions);
  };

  const handleUpdateOption = <K extends keyof ProductEnhanceOptions>(
    key: K,
    value: ProductEnhanceOptions[K]
  ) => {
    const updated = { ...enhancerOptions, [key]: value };
    setEnhancerOptions(updated);
    if (enhancingPhoto) {
      applyCanvasEnhance(enhancingPhoto.url, updated);
    }
  };

  const resetEnhancerOptions = () => {
    const defaults: ProductEnhanceOptions = {
      whiteBalance: true,
      vibranceBoost: 35,
      contrastBoost: 25,
      sharpness: 45,
      brightnessDelta: 8,
      clarifyLabels: true,
    };
    setEnhancerOptions(defaults);
    if (enhancingPhoto) {
      applyCanvasEnhance(enhancingPhoto.url, defaults);
    }
  };

  const handleRunGeminiAnalysis = async () => {
    if (!enhancingPhoto || !enhancedPreviewUrl) return;
    setIsEnhancingProcess(true);
    try {
      const resp = await fetch("/api/admin/enhance-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: enhancedPreviewUrl,
          filename: enhancingPhoto.filename,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setGeminiAnalysis({
          suggestedTitle: data.suggestedTitle,
          category: data.category,
          description: data.description,
          aiAdvice: data.aiAdvice,
        });
        toast.success("تم فحص وتحديد الصنف بواسطة Gemini", `الاسم المقترح: ${data.suggestedTitle}`);
      } else {
        toast.error("تنبيه", data.error || "تعذر التحليل بواسطة Gemini");
      }
    } catch {
      toast.error("خطأ", "تعذر الاتصال بخدمة التحليل");
    } finally {
      setIsEnhancingProcess(false);
    }
  };

  const handleSaveEnhancedToPool = async () => {
    if (!enhancingPhoto || !enhancedPreviewUrl) return;
    setIsEnhancingProcess(true);
    try {
      const resp = await fetch("/api/admin/enhance-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: enhancedPreviewUrl,
          filename: `studio_${enhancingPhoto.filename}`,
          customTitle: geminiAnalysis?.suggestedTitle,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        toast.success("تم حفظ الصورة المحسنة في البنك بنجاح!", "أصبحت الصورة متاحة الآن بجودة استوديو احترافية.");
        setEnhancingPhoto(null);
        fetchPhotos();
      } else {
        toast.error("فشل الحفظ", data.error || "تعذر الحفظ في البنك");
      }
    } catch (err) {
      toast.error("خطأ", (err as Error).message || "فشل الاتصال");
    } finally {
      setIsEnhancingProcess(false);
    }
  };

  // Fetch photos from API
  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/photos");
      const data = await res.json();
      if (data.success && Array.isArray(data.photos)) {
        setPhotos(data.photos);
      } else {
        toast.error("خطأ", data.error || "تعذر جلب الصور");
      }
    } catch {
      toast.error("خطأ", "تعذر الاتصال بمركز إدارة الصور");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Load catalog and existing links on mount
  useEffect(() => {
    async function loadInitialData() {
      await fetchPhotos();

      // Load catalog from localStorage
      try {
        const CURRENT_CACHE_KEY = "copycat_inventory_v8_local_catalog";
        const saved = localStorage.getItem(CURRENT_CACHE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCatalogItems(parsed);
          }
        }
      } catch {}

      // Load links map from localStorage
      try {
        const savedLinks = localStorage.getItem("copycat_photo_pool_links");
        if (savedLinks) {
          setLinkMap(JSON.parse(savedLinks));
        }
      } catch {}
    }

    loadInitialData();
  }, [fetchPhotos]);

  // Handle file uploads (Camera or bulk files)
  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch("/api/admin/photos", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success("تم الرفع بنجاح!", data.message || `تمت إضافة ${data.count} صور جديدة`);
        await fetchPhotos();
      } else {
        toast.error("فشل الرفع", data.error || "حدث خطأ أثناء رفع الصور");
      }
    } catch {
      toast.error("خطأ", "تعذر الاتصال بالسيرفر لرفع الصور");
    } finally {
      setIsUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle deleting a photo from pool
  const handleDeletePhoto = async (photo: PoolPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`هل أنت متأكد من حذف الصورة ${photo.filename} نهائياً من بنك الصور؟`)) return;

    try {
      const res = await fetch(`/api/admin/photos?filename=${encodeURIComponent(photo.filename)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("تم الحذف", `تم حذف الصورة ${photo.filename} بنجاح`);
        setPhotos((prev) => prev.filter((p) => p.filename !== photo.filename));

        // Clean link if existed
        if (linkMap[photo.url]) {
          const updatedLinks = { ...linkMap };
          delete updatedLinks[photo.url];
          setLinkMap(updatedLinks);
          localStorage.setItem("copycat_photo_pool_links", JSON.stringify(updatedLinks));
        }
      } else {
        toast.error("خطأ", data.error || "تعذر حذف الصورة");
      }
    } catch {
      toast.error("خطأ", "تعذر الاتصال بالسيرفر لحذف الصورة");
    }
  };

  // Assign photo to selected product
  const handleConfirmAssignment = async () => {
    if (!assigningPhoto || !selectedProductId) {
      toast.error("بيانات ناقصة", "يرجى تحديد صنف من القائمة لربط الصورة به.");
      return;
    }

    const targetProduct = catalogItems.find((p) => p.id === selectedProductId);
    if (!targetProduct) return;

    const photoUrl = assigningPhoto.url;

    try {
      // 1. Update product in state and localStorage
      const updatedCatalog = catalogItems.map((item) => {
        if (item.id === selectedProductId) {
          const updated = { ...item };
          if (linkAsPrimary) {
            updated.image = photoUrl;
            if (!updated.images) updated.images = [photoUrl];
            else if (!updated.images.includes(photoUrl)) updated.images.unshift(photoUrl);
          } else {
            if (!updated.images) updated.images = [updated.image || photoUrl, photoUrl];
            else if (!updated.images.includes(photoUrl)) updated.images.push(photoUrl);
          }
          return sanitizeItem(updated);
        }
        return item;
      });

      setCatalogItems(updatedCatalog);
      localStorage.setItem("copycat_inventory_v8_local_catalog", JSON.stringify(updatedCatalog));

      // 2. Update custom images map for catalog persistence
      const customMap = JSON.parse(localStorage.getItem("copycat_custom_images") || "{}");
      const currentCustom = customMap[selectedProductId] || {};
      customMap[selectedProductId] = {
        image: linkAsPrimary ? photoUrl : currentCustom.image || photoUrl,
        images: linkAsPrimary
          ? [photoUrl, ...(currentCustom.images || []).filter((u: string) => u !== photoUrl)]
          : [...(currentCustom.images || []), photoUrl],
      };
      localStorage.setItem("copycat_custom_images", JSON.stringify(customMap));

      // 3. Update pool links map
      const updatedLinkMap = {
        ...linkMap,
        [photoUrl]: {
          productId: targetProduct.id,
          productName: targetProduct.name,
          category: targetProduct.category,
          isPrimary: linkAsPrimary,
        },
      };
      setLinkMap(updatedLinkMap);
      localStorage.setItem("copycat_photo_pool_links", JSON.stringify(updatedLinkMap));

      // 4. Update Supabase if configured
      if (isSupabaseConfigured) {
        try {
          await supabase
            .from("inventory")
            .update({
              image: linkAsPrimary ? photoUrl : undefined,
            })
            .eq("id", selectedProductId);
        } catch (err) {
          console.warn("Supabase sync note:", err);
        }
      }

      toast.success(
        "تم ربط الصورة بالمنتج بنجاح!",
        `تم تعيينها ${linkAsPrimary ? "كصورة رئيسية" : "في معرض صور"} الصنف: "${targetProduct.name}"`
      );

      setAssigningPhoto(null);
      setSelectedProductId(null);
      setProductSearch("");
    } catch {
      toast.error("خطأ", "تعذر حفظ ربط الصورة بالمنتج");
    }
  };

  // Unlink a photo
  const handleUnlink = (photoUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const linkInfo = linkMap[photoUrl];
    if (!linkInfo) return;

    if (confirm(`هل تريد فك ارتباط هذه الصورة بالصنف "${linkInfo.productName}"؟`)) {
      const updated = { ...linkMap };
      delete updated[photoUrl];
      setLinkMap(updated);
      localStorage.setItem("copycat_photo_pool_links", JSON.stringify(updated));
      toast.info("تم فك الارتباط", `تمت إزالة ربط الصورة بالصنف "${linkInfo.productName}".`);
    }
  };

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      // Status filter
      const isLinked = Boolean(linkMap[photo.url]);
      if (statusFilter === "unassigned" && isLinked) return false;
      if (statusFilter === "assigned" && !isLinked) return false;

      // Source filter
      if (sourceFilter === "facebook" && photo.source !== "facebook") return false;
      if (sourceFilter === "upload" && photo.source !== "upload") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = photo.filename.toLowerCase().includes(q);
        const linkedInfo = linkMap[photo.url];
        const matchProduct =
          linkedInfo &&
          (linkedInfo.productName.toLowerCase().includes(q) ||
            linkedInfo.category.toLowerCase().includes(q));
        if (!matchName && !matchProduct) return false;
      }

      return true;
    });
  }, [photos, linkMap, statusFilter, sourceFilter, searchQuery]);

  // Filtered products for modal search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return catalogItems.slice(0, 20);
    const q = productSearch.toLowerCase().trim();
    return catalogItems.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.id.toString() === q
    );
  }, [catalogItems, productSearch]);

  const assignedCount = Object.keys(linkMap).length;
  const unassignedCount = Math.max(0, photos.length - assignedCount);

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface p-space-md sm:p-space-xl">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-space-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md pb-space-md border-b border-surface-container-high/40">
          <div>
            <div className="flex items-center gap-space-xs text-primary font-label-code text-label-code mb-1">
              <Link href="/admin" className="hover:underline flex items-center gap-1">
                لوحة التحكم
              </Link>
              <span>/</span>
              <Link href="/admin/inventory" className="hover:underline flex items-center gap-1">
                المخزن والكتالوج
              </Link>
              <span>/</span>
              <span>بنك ومكتبة الصور</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg font-bold flex items-center gap-space-xs">
              <span>🖼️ بنك ومكتبة صور المنتجات</span>
              <span className="text-label-sm font-label-code px-space-xs py-1 rounded-full bg-primary/20 text-primary">
                {photos.length} صورة
              </span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              مستودع مركزي يجمع صور صفحة فيسبوك والصور الملتقطة بكاميرا الهاتف لربطها بمنتجات المكتبة في أي وقت.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-space-xs">
            {/* Hidden Inputs */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleUploadFiles(e.target.files)}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUploadFiles(e.target.files)}
            />

            {/* Mobile Camera Shoot */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-space-md py-space-sm rounded-xl bg-primary text-on-primary font-bold shadow-md hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-5 h-5" />
              <span>تصوير بالكاميرا الآن</span>
            </button>

            {/* Bulk Upload Files */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-space-md py-space-sm rounded-xl bg-secondary-container text-on-secondary-container font-bold hover:bg-secondary transition-all cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
              <span>رفع مجموعة صور</span>
            </button>

            {/* Refresh / Sync */}
            <button
              onClick={fetchPhotos}
              disabled={isLoading}
              className="flex items-center gap-1 px-space-sm py-space-sm rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
              title="تحديث ومزامنة الصور"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm mt-space-md">
          <div className="p-space-sm rounded-xl bg-surface-container-low border border-surface-container-high/40">
            <span className="text-body-xs font-label-code text-on-surface-variant block">إجمالي الصور المتاحة</span>
            <span className="text-headline-sm font-bold text-primary">{photos.length}</span>
          </div>

          <div className="p-space-sm rounded-xl bg-surface-container-low border border-surface-container-high/40">
            <span className="text-body-xs font-label-code text-on-surface-variant block">صور مرتبطة بمنتجات</span>
            <span className="text-headline-sm font-bold text-emerald-500">{assignedCount}</span>
          </div>

          <div className="p-space-sm rounded-xl bg-surface-container-low border border-surface-container-high/40">
            <span className="text-body-xs font-label-code text-on-surface-variant block">صور بحاجة لتخصيص</span>
            <span className="text-headline-sm font-bold text-amber-500">{unassignedCount}</span>
          </div>

          <div className="p-space-sm rounded-xl bg-surface-container-low border border-surface-container-high/40">
            <span className="text-body-xs font-label-code text-on-surface-variant block">أصناف الكتالوج المسجلة</span>
            <span className="text-headline-sm font-bold text-on-surface">{catalogItems.length} صنف</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm mt-space-md p-space-sm rounded-xl bg-surface-container-low border border-surface-container-high/40">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-space-sm py-1 rounded-lg text-body-sm font-medium transition-colors cursor-pointer ${
                statusFilter === "all"
                  ? "bg-primary text-on-primary font-bold"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface"
              }`}
            >
              الكل ({photos.length})
            </button>
            <button
              onClick={() => setStatusFilter("unassigned")}
              className={`px-space-sm py-1 rounded-lg text-body-sm font-medium transition-colors cursor-pointer ${
                statusFilter === "unassigned"
                  ? "bg-amber-500 text-white font-bold"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface"
              }`}
            >
              ⚠️ بحاجة لربط ({unassignedCount})
            </button>
            <button
              onClick={() => setStatusFilter("assigned")}
              className={`px-space-sm py-1 rounded-lg text-body-sm font-medium transition-colors cursor-pointer ${
                statusFilter === "assigned"
                  ? "bg-emerald-600 text-white font-bold"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface"
              }`}
            >
              ✓ مرتبطة ({assignedCount})
            </button>

            <span className="h-4 w-px bg-surface-container-high mx-1" />

            {/* Source Tabs */}
            <button
              onClick={() => setSourceFilter("all")}
              className={`px-space-xs py-1 rounded-lg text-label-sm transition-colors cursor-pointer ${
                sourceFilter === "all" ? "text-primary font-bold" : "text-on-surface-variant"
              }`}
            >
              كل المصادر
            </button>
            <button
              onClick={() => setSourceFilter("facebook")}
              className={`px-space-xs py-1 rounded-lg text-label-sm transition-colors cursor-pointer ${
                sourceFilter === "facebook" ? "text-primary font-bold" : "text-on-surface-variant"
              }`}
            >
              فيسبوك
            </button>
            <button
              onClick={() => setSourceFilter("upload")}
              className={`px-space-xs py-1 rounded-lg text-label-sm transition-colors cursor-pointer ${
                sourceFilter === "upload" ? "text-primary font-bold" : "text-on-surface-variant"
              }`}
            >
              تصوير الكاميرا
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="بحث باسم الصورة أو اسم المنتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-1.5 text-body-sm bg-surface-container border border-surface-container-high rounded-xl text-on-surface focus:outline-none focus:border-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto">
        {isLoading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-space-sm" />
            <p className="font-body-md text-body-md text-on-surface-variant">جاري تحميل وفهرسة صور المكتبة...</p>
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="py-20 text-center rounded-2xl bg-surface-container-low border border-surface-container-high/40 p-space-xl">
            <AlertCircle className="w-12 h-12 text-on-surface-variant mx-auto mb-space-sm opacity-50" />
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">لا توجد صور مطابقة</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-md mx-auto">
              لم يتم العثور على أي صور وفقاً لمعايير البحث الحالية. يمكنك تصوير صور جديدة بالكاميرا أو رفعها من جهازك.
            </p>
            <div className="flex items-center justify-center gap-space-xs mt-space-md">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-1 px-space-md py-space-sm rounded-xl bg-primary text-on-primary font-bold"
              >
                <Camera className="w-4 h-4" />
                <span>التقاط صورة بالكاميرا</span>
              </button>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setSourceFilter("all");
                }}
                className="px-space-md py-space-sm rounded-xl bg-surface-container text-on-surface"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-space-sm">
            {filteredPhotos.map((photo) => {
              const linkInfo = linkMap[photo.url];
              const isLinked = Boolean(linkInfo);

              return (
                <div
                  key={photo.id}
                  className={`group relative flex flex-col rounded-xl overflow-hidden bg-surface-container-low border transition-all duration-200 hover:shadow-lg ${
                    isLinked
                      ? "border-emerald-500/40 hover:border-emerald-500"
                      : "border-surface-container-high/60 hover:border-primary/60"
                  }`}
                >
                  {/* Image Thumbnail Container */}
                  <div
                    className="relative aspect-square w-full bg-surface-container cursor-pointer overflow-hidden"
                    onClick={() => setPreviewPhoto(photo)}
                  >
                    <Image
                      src={photo.url}
                      alt={photo.filename}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Source Badge */}
                    <div className="absolute top-2 right-2">
                      <span
                        className={`text-[10px] font-label-code px-1.5 py-0.5 rounded-md backdrop-blur-md font-bold shadow-sm ${
                          photo.source === "facebook"
                            ? "bg-blue-600/80 text-white"
                            : "bg-emerald-600/80 text-white"
                        }`}
                      >
                        {photo.source === "facebook" ? "فيسبوك" : "كاميرا"}
                      </span>
                    </div>

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewPhoto(photo);
                        }}
                        className="p-2 rounded-full bg-surface-container/90 text-on-surface hover:bg-surface-bright"
                        title="معاينة بكامل الشاشة"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeletePhoto(photo, e)}
                        className="p-2 rounded-full bg-rose-500/90 text-white hover:bg-rose-600"
                        title="حذف الصورة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Info & Assignment Bar */}
                  <div className="p-2 flex flex-col justify-between flex-1 gap-2">
                    {/* Status Badge */}
                    {isLinked ? (
                      <div className="flex flex-col gap-0.5 bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{linkInfo.productName}</span>
                          </span>
                          <button
                            onClick={(e) => handleUnlink(photo.url, e)}
                            className="text-on-surface-variant hover:text-rose-500 text-[10px] underline ml-1"
                            title="فك الارتباط"
                          >
                            فك
                          </button>
                        </div>
                        <span className="text-[10px] text-on-surface-variant truncate">
                          {linkInfo.category} • {linkInfo.isPrimary ? "صورة رئيسية" : "في المعرض"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">غير مخصصة لأي صنف</span>
                      </div>
                    )}

                    {/* Action Buttons: AI Enhance + Link to Product */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        onClick={() => openEnhancerModal(photo)}
                        className="py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 bg-linear-to-r from-violet-600/20 to-primary/20 hover:from-violet-600/30 hover:to-primary/30 text-primary border border-primary/30 transition-all cursor-pointer"
                        title="تحسين الإضاءة وإزالة اصفرار التصوير بالموبايل وتوضيح الصنف بالذكاء الاصطناعي"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>تحسين AI ✨</span>
                      </button>

                      <button
                        onClick={() => {
                          setAssigningPhoto(photo);
                          if (isLinked) {
                            setSelectedProductId(linkInfo.productId);
                            setLinkAsPrimary(linkInfo.isPrimary);
                          } else {
                            setSelectedProductId(null);
                            setLinkAsPrimary(true);
                          }
                          setProductSearch("");
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isLinked
                            ? "bg-surface-container hover:bg-surface-container-high text-on-surface"
                            : "bg-primary text-on-primary hover:bg-primary/90 shadow-sm"
                        }`}
                      >
                        <Link2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{isLinked ? "تعديل التخصيص" : "ربط بمنتج"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Assign Photo to Product */}
      {assigningPhoto && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-space-sm animate-in fade-in">
          <div className="bg-surface-container-low border border-surface-container-high rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-space-md border-b border-surface-container-high/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    ربط الصورة بمنتج من كتالوج المكتبة
                  </h3>
                  <p className="text-body-xs text-on-surface-variant">
                    اختر الصنف المطلوب لتعيين هذه الصورة له فوراً في المتجر والمخزن.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssigningPhoto(null)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-space-md flex-1 overflow-y-auto space-y-space-md">
              {/* Photo Preview & Options */}
              <div className="flex items-center gap-space-md p-space-sm rounded-xl bg-surface-container">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-surface-container-high">
                  <Image
                    src={assigningPhoto.url}
                    alt={assigningPhoto.filename}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-label-sm font-label-code text-on-surface-variant block truncate">
                    {assigningPhoto.filename}
                  </span>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 text-body-xs text-on-surface cursor-pointer">
                      <input
                        type="radio"
                        name="linkRole"
                        checked={linkAsPrimary}
                        onChange={() => setLinkAsPrimary(true)}
                        className="text-primary focus:ring-primary"
                      />
                      <span>🌟 تعيين كصورة رئيسية للمنتج (Main Image)</span>
                    </label>
                    <label className="flex items-center gap-2 text-body-xs text-on-surface cursor-pointer">
                      <input
                        type="radio"
                        name="linkRole"
                        checked={!linkAsPrimary}
                        onChange={() => setLinkAsPrimary(false)}
                        className="text-primary focus:ring-primary"
                      />
                      <span>🖼️ إضافة إلى معرض صور الصنف (Gallery)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Search Box */}
              <div>
                <label className="block text-body-xs font-bold text-on-surface-variant mb-1">
                  ابحث عن الصنف في الكتالوج ({catalogItems.length} صنف مسجل):
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="text"
                    placeholder="اكتب اسم الصنف (مثل: قص ولزق، ورق تصوير، كشكول، قلم...)"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    autoFocus
                    className="w-full pl-3 pr-9 py-2 text-body-sm bg-surface-container border border-surface-container-high rounded-xl text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Products List */}
              <div className="space-y-1 max-h-60 overflow-y-auto border border-surface-container-high/40 rounded-xl p-1 bg-surface-container-lowest">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-on-surface-variant text-body-xs">
                    لم يتم العثور على أصناف مطابقة لكلمة البحث.
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = selectedProductId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProductId(p.id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/20 border border-primary text-on-surface font-bold"
                            : "hover:bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-10 h-10 rounded-md bg-surface-container shrink-0 overflow-hidden relative border border-surface-container-high/40">
                            {p.image ? (
                              <Image src={p.image} alt={p.name} fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-on-surface-variant text-[10px]">
                                بدون
                              </div>
                            )}
                          </div>
                          <div className="truncate">
                            <span className="text-body-sm text-on-surface block truncate font-medium">
                              {p.name}
                            </span>
                            <span className="text-[11px] text-on-surface-variant block">
                              {p.category} • {p.price} ج.م
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 ml-2">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center">
                              <Check className="w-4 h-4" />
                            </div>
                          ) : (
                            <span className="text-[11px] text-primary hover:underline">اختيار</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-space-md border-t border-surface-container-high/40 flex items-center justify-between bg-surface-container-low">
              <button
                onClick={() => setAssigningPhoto(null)}
                className="px-space-md py-space-xs rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-body-sm"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmAssignment}
                disabled={!selectedProductId}
                className="flex items-center gap-2 px-space-lg py-space-xs rounded-xl bg-primary text-on-primary font-bold text-body-sm hover:bg-primary/90 transition-all disabled:opacity-40 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد وحفظ الربط بالمنتج</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: AI Product Photo Enhancer & Gemini Studio */}
      {enhancingPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-surface-container-low border border-surface-container-high rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-surface-container-high/40 flex items-center justify-between bg-surface-container/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-primary to-violet-600 flex items-center justify-center text-white shadow-md shadow-primary/20">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-headline-sm text-base sm:text-lg font-bold flex items-center gap-2">
                    <span>استوديو تحسين وتوضيح صور المنتجات (Gemini & Studio Clarifier)</span>
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                      ذكاء اصطناعي محلي
                    </span>
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    معالجة فورية لتصوير الموبايل: إزالة اصفرار إضاءة المحل، تزهية ألوان الأدوات المكتبية، وتوضيح الباركود والنصوص.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEnhancingPhoto(null)}
                className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Visual Preview (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-primary">
                    <Sparkles className="w-4 h-4" />
                    <span>معاينة النتيجة بعد التحسين</span>
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-mono font-bold">
                      0 KB على Supabase (تخزين محلي 100%)
                    </span>
                  </div>
                </div>

                {/* Main Comparison Canvas / Image */}
                <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-surface-container-high bg-black/40 flex items-center justify-center shadow-inner">
                  {enhancedPreviewUrl ? (
                    <img
                      src={enhancedPreviewUrl}
                      alt="معاينة محسنة"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-on-surface-variant">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <span className="text-xs">جاري معالجة الصورة في الاستوديو...</span>
                    </div>
                  )}

                  {/* Top Floating Badge */}
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>معالجة إضاءة استوديو + Unsharp Mask</span>
                  </div>
                </div>

                {/* Mini original thumbnail preview */}
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container/50 border border-surface-container-high/40">
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-surface-container-high shrink-0 bg-black/20">
                    <img
                      src={enhancingPhoto.url}
                      alt="الأصلية"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-on-surface">الصورة الأصلية الملتقطة بالموبايل</div>
                    <div className="text-on-surface-variant text-[11px] mt-0.5">
                      {enhancingPhoto.filename} • {(enhancingPhoto.sizeBytes / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (enhancedPreviewUrl === enhancingPhoto.url) {
                        applyCanvasEnhance(enhancingPhoto.url, enhancerOptions);
                      } else {
                        setEnhancedPreviewUrl(enhancingPhoto.url);
                      }
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-high transition-all"
                  >
                    {enhancedPreviewUrl === enhancingPhoto.url ? "إظهار النتيجة المحسنة" : "مقارنة بالأصل"}
                  </button>
                </div>
              </div>

              {/* Right Column: Enhancer Controls & Gemini AI (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                {/* Studio Adjustments Card */}
                <div className="p-3.5 rounded-xl bg-surface-container/50 border border-surface-container-high/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs flex items-center gap-1.5 text-on-surface">
                      <Sliders className="w-4 h-4 text-primary" />
                      <span>معايرات إضاءة الاستوديو للموبايل</span>
                    </h3>
                    <button
                      onClick={resetEnhancerOptions}
                      className="text-[11px] text-on-surface-variant hover:text-primary transition-colors underline"
                    >
                      إعادة الضبط
                    </button>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-2 pt-1 border-t border-surface-container-high/40">
                    <label className="flex items-center justify-between text-xs cursor-pointer p-1.5 rounded-lg hover:bg-surface-container">
                      <span className="flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                        <span>موازنة الإضاءة وإزالة الصفرة (White Balance)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={enhancerOptions.whiteBalance}
                        onChange={(e) => handleUpdateOption("whiteBalance", e.target.checked)}
                        className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs cursor-pointer p-1.5 rounded-lg hover:bg-surface-container">
                      <span className="flex items-center gap-1.5">
                        <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>توضيح وقراءة ملصقات الباركود والنصوص</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={enhancerOptions.clarifyLabels}
                        onChange={(e) => handleUpdateOption("clarifyLabels", e.target.checked)}
                        className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Sliders */}
                  <div className="space-y-2.5 pt-2 border-t border-surface-container-high/40 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-on-surface-variant">تزهية ألوان الأدوات المكتبية (Vibrance)</span>
                        <span className="font-bold font-mono text-primary">{enhancerOptions.vibranceBoost}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="80"
                        value={enhancerOptions.vibranceBoost}
                        onChange={(e) => handleUpdateOption("vibranceBoost", Number(e.target.value))}
                        className="w-full accent-primary h-1.5 bg-surface-container rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-on-surface-variant">عمق وتباين الإضاءة (Contrast)</span>
                        <span className="font-bold font-mono text-primary">{enhancerOptions.contrastBoost}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="60"
                        value={enhancerOptions.contrastBoost}
                        onChange={(e) => handleUpdateOption("contrastBoost", Number(e.target.value))}
                        className="w-full accent-primary h-1.5 bg-surface-container rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-on-surface-variant">حدة الحواف والتفاصيل (Sharpness)</span>
                        <span className="font-bold font-mono text-primary">{enhancerOptions.sharpness}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="90"
                        value={enhancerOptions.sharpness}
                        onChange={(e) => handleUpdateOption("sharpness", Number(e.target.value))}
                        className="w-full accent-primary h-1.5 bg-surface-container rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-on-surface-variant">مستوى السطوع (Brightness)</span>
                        <span className="font-bold font-mono text-primary">
                          {(enhancerOptions.brightnessDelta ?? 0) > 0 ? `+${enhancerOptions.brightnessDelta}` : (enhancerOptions.brightnessDelta ?? 0)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-20"
                        max="30"
                        value={enhancerOptions.brightnessDelta ?? 0}
                        onChange={(e) => handleUpdateOption("brightnessDelta", Number(e.target.value))}
                        className="w-full accent-primary h-1.5 bg-surface-container rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Gemini AI Vision Card */}
                <div className="p-3.5 rounded-xl bg-linear-to-br from-violet-950/30 to-surface-container/50 border border-violet-500/20 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs flex items-center gap-1.5 text-violet-300">
                      <Bot className="w-4 h-4 text-violet-400" />
                      <span>التعرف الذكي على الصنف بواسطة Gemini Vision</span>
                    </h3>
                  </div>

                  {!geminiAnalysis ? (
                    <div className="text-xs space-y-2">
                      <p className="text-on-surface-variant text-[11px] leading-relaxed">
                        دع Gemini يحلل صورة المنتج للتعرف على نوع الصنف (كشكول، قلم، مسطرة، آلة حاسبة) واقتراح اسم ووصف بيع جاهز.
                      </p>
                      <button
                        onClick={handleRunGeminiAnalysis}
                        disabled={isEnhancingProcess}
                        className="w-full py-2 px-3 rounded-lg bg-violet-600/30 hover:bg-violet-600/40 text-violet-200 border border-violet-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        {isEnhancingProcess ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-violet-300" />
                            <span>جاري تحليل وتحديد الصنف بواسطة Gemini...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-violet-300" />
                            <span>تحليل بالذكاء الاصطناعي (Gemini Vision)</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs animate-in fade-in">
                      <div className="p-2.5 rounded-lg bg-surface-container-high/40 border border-violet-500/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-violet-400 font-bold">الاسم المقترح:</span>
                          <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-md font-bold">
                            {geminiAnalysis.category}
                          </span>
                        </div>
                        <div className="font-bold text-sm text-on-surface">{geminiAnalysis.suggestedTitle}</div>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          {geminiAnalysis.description}
                        </p>
                        {geminiAnalysis.aiAdvice && (
                          <div className="pt-1.5 border-t border-surface-container-high/40 text-[10px] text-amber-300/90 flex items-start gap-1">
                            <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                            <span>نصيحة العرض: {geminiAnalysis.aiAdvice}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleRunGeminiAnalysis}
                        disabled={isEnhancingProcess}
                        className="text-[11px] text-violet-400 hover:text-violet-300 underline"
                      >
                        إعادة الفحص بـ Gemini
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-surface-container-high/40 flex items-center justify-between bg-surface-container/30">
              <button
                onClick={() => setEnhancingPhoto(null)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveEnhancedToPool}
                disabled={isEnhancingProcess || !enhancedPreviewUrl}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-primary to-violet-600 text-white font-bold text-xs hover:opacity-95 transition-all shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer"
              >
                {isEnhancingProcess ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ الصورة المحسنة...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>حفظ النسخة المحسنة في مستودع الصور 💾</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Fullscreen Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="relative w-full h-full">
              <Image
                src={previewPhoto.url}
                alt={previewPhoto.filename}
                fill
                className="object-contain"
              />
            </div>
            <div className="mt-2 text-center text-white/80 font-label-code text-label-sm">
              {previewPhoto.filename} ({(previewPhoto.sizeBytes / 1024).toFixed(0)} KB)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
