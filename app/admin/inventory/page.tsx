"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  Plus,
  Search,
  Trash2,
  Edit2,
  Package,
  X,
  Save,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Send,
  Upload,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  RefreshCw,
  Camera,
  ExternalLink,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { formatCurrency, safeOpenUrl, compressImageToWebP } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { type InventoryItem, INITIAL_PRODUCTS, sanitizeItem } from "@/lib/inventory";

const ENGINEER_PHONE_INTL = "201206385464";
const ENGINEER_PHONE_LOCAL = "01206385464";

export function isItemIncomplete(item: InventoryItem): boolean {
  return (
    !item.name ||
    !item.name.trim() ||
    item.price === undefined ||
    item.price === null ||
    isNaN(Number(item.price)) ||
    Number(item.price) <= 0 ||
    !item.category ||
    !item.category.trim()
  );
}

export function isItemMissingImage(item: InventoryItem): boolean {
  return !item.image || !item.image.trim();
}

export default function InventoryPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [completionFilter, setCompletionFilter] = useState<"all" | "complete" | "incomplete" | "missing_image">("all");
  const [isAddingModal, setIsAddingModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // Form State (Stock count removed as per requirement #3)
  const [name, setName] = useState("");
  const [category, setCategory] = useState("أدوات كتابة ورسم");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [wholesalePrice, setWholesalePrice] = useState<number | "">("");
  const [wholesaleMinQty, setWholesaleMinQty] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // AI Product Images Assistant State
  const [isAiSearchingImages, setIsAiSearchingImages] = useState(false);
  const [aiDiscoveredImages, setAiDiscoveredImages] = useState<string[]>([]);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiDetectedName, setAiDetectedName] = useState("");

  // Photo Pool Picker State
  const [showPoolPicker, setShowPoolPicker] = useState(false);
  const [poolPhotos, setPoolPhotos] = useState<{ id: string; filename: string; url: string; source: string }[]>([]);
  const [poolSearch, setPoolSearch] = useState("");
  const [isLoadingPool, setIsLoadingPool] = useState(false);

  const openPoolPicker = async () => {
    setShowPoolPicker(true);
    setIsLoadingPool(true);
    try {
      const res = await fetch("/api/admin/photos");
      const data = await res.json();
      if (data.success && Array.isArray(data.photos)) {
        setPoolPhotos(data.photos);
      }
    } catch {
      toast.error("خطأ", "تعذر جلب الصور من بنك الصور");
    } finally {
      setIsLoadingPool(false);
    }
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const compressed = await compressImageToWebP(file, 800, 0.82);
      setImage(compressed);
      setShowAiPrompt(true);
      toast.success(
        "تم تجهيز وضغط الصورة الرئيسية",
        "تم حفظها بصيغة WebP خفيفة. هل ترغب بأن يبحث الـ AI عن 3 صور إضافية للمعرض؟"
      );
    } catch {
      toast.error("خطأ", "تعذر قراءة ملف الصورة.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleGalleryImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploadingImage(true);
    try {
      const compressedList = await Promise.all(
        files.map((file) => compressImageToWebP(file, 800, 0.82))
      );
      setImages((prev) => [...prev, ...compressedList]);
      toast.success("تم إضافة الصور للمعرض", `تمت إضافة ${compressedList.length} صور إضافية بنجاح.`);
    } catch {
      toast.error("خطأ", "تعذر معالجة بعض الصور.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // AI Product Image Search Action
  const handleAiImageSearch = async (providedImage?: string) => {
    const targetImage = providedImage || (image.startsWith("data:") ? image : undefined);
    const targetName = name.trim();
    if (!targetName && !targetImage) {
      toast.error("بيانات ناقصة", "يرجى كتابة اسم الصنف أو رفع صورة بالهاتف أولاً ليبحث الذكاء الاصطناعي عنها.");
      return;
    }

    setIsAiSearchingImages(true);
    setShowAiPrompt(false);
    try {
      const res = await fetch("/api/ai/product-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: targetName,
          category: isCustomCategory ? customCategory : category,
          notes,
          imageBase64: targetImage,
        }),
      });
      const data = await res.json();
      if (data.success && data.allImages?.length > 0) {
        setAiDiscoveredImages(data.allImages);
        if (data.productName && (!name.trim() || name === "صنف جديد")) {
          setName(data.productName);
          setAiDetectedName(data.productName);
        }
        toast.success(
          "تم العثور على صور بالذكاء الاصطناعي!",
          `تم جلب ${data.allImages.length} صور واضحة جاهزة للاستخدام والمعرض.`
        );
      } else {
        toast.info("تنبيه", "لم تتوفر صور إضافية مطابقة، يمكنك تجربة كلمات بحث أخرى.");
      }
    } catch {
      toast.error("خطأ", "تعذر الاتصال بخدمة البحث الذكي عن الصور.");
    } finally {
      setIsAiSearchingImages(false);
    }
  };

  const applyAiImagesAll = () => {
    if (aiDiscoveredImages.length === 0) return;
    if (!image) {
      setImage(aiDiscoveredImages[0]);
    }
    const rest = image ? aiDiscoveredImages : aiDiscoveredImages.slice(1);
    setImages((prev) => {
      const combined = [...prev];
      for (const imgUrl of rest) {
        if (!combined.includes(imgUrl) && combined.length < 6) {
          combined.push(imgUrl);
        }
      }
      return combined;
    });
    setAiDiscoveredImages([]);
    toast.success("تم تطبيق الصور بنجاح!", "تم تعيين الصورة وتغذية المعرض بالصور الإضافية.");
  };

  // Load from Supabase with localStorage backup & auto image hydration
  useEffect(() => {
    async function loadData() {
      try {
        // 1. Purge legacy / corrupted cache keys that contained external wikimedia/unsplash links
        const STALE_KEYS = [
          "copycat_inventory_v1",
          "copycat_inventory_v2",
          "copycat_inventory_v2_img",
          "copycat_inventory_v3",
          "copycat_inventory_v4_realistic",
          "copycat_inventory_v5_pure_real",
          "copycat_inventory_v6_smart_avatar",
          "copycat_inventory_v7_clean_assets",
        ];
        for (const key of STALE_KEYS) {
          try {
            localStorage.removeItem(key);
          } catch {}
        }

        let customImagesMap: Record<string | number, { image?: string; images?: string[] }> = {};
        try {
          const savedCustom = localStorage.getItem("copycat_custom_images");
          if (savedCustom) {
            const parsed = JSON.parse(savedCustom);
            let dirty = false;
            for (const id in parsed) {
              const img = parsed[id]?.image;
              if (
                !img ||
                img.includes("wikimedia.org") ||
                img.includes("unsplash.com") ||
                img.includes("undefined") ||
                img.includes("null")
              ) {
                delete parsed[id];
                dirty = true;
              }
            }
            if (dirty) {
              localStorage.setItem("copycat_custom_images", JSON.stringify(parsed));
            }
            customImagesMap = parsed;
          }
        } catch {}

        const mergeWithCustomImages = (list: InventoryItem[]): InventoryItem[] => {
          return list.map((it) => {
            const custom = customImagesMap[it.id];
            if (custom && custom.image) {
              return sanitizeItem({
                ...it,
                image: custom.image,
                images: custom.images || [custom.image],
              });
            }
            const initMatch = INITIAL_PRODUCTS.find((p) => p.id === it.id || p.name === it.name);
            if (initMatch) {
              return sanitizeItem({
                ...it,
                image: initMatch.image,
                images: initMatch.images,
              });
            }
            return sanitizeItem(it);
          });
        };

        const CURRENT_CACHE_KEY = "copycat_inventory_v8_local_catalog";
        const saved = localStorage.getItem(CURRENT_CACHE_KEY);

        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length >= INITIAL_PRODUCTS.length) {
            const sanitizedList = mergeWithCustomImages(parsed);
            setItems(sanitizedList);
          } else {
            const sanitizedInit = mergeWithCustomImages(INITIAL_PRODUCTS);
            setItems(sanitizedInit);
            localStorage.setItem(CURRENT_CACHE_KEY, JSON.stringify(sanitizedInit));
          }
        } else {
          const sanitizedInit = mergeWithCustomImages(INITIAL_PRODUCTS);
          setItems(sanitizedInit);
          localStorage.setItem(CURRENT_CACHE_KEY, JSON.stringify(sanitizedInit));
        }

        // 2. Fetch from Supabase only if configured
        if (isSupabaseConfigured) {
          const { data, error } = await supabase
            .from("inventory")
            .select("*")
            .order("id", { ascending: true });

          if (!error && data && data.length > 0) {
            const hydrated = mergeWithCustomImages(data as InventoryItem[]);
            setItems(hydrated);
            localStorage.setItem(CURRENT_CACHE_KEY, JSON.stringify(hydrated));
          }
        }
      } catch {
        console.log("Using local cache for inventory data");
      }
    }
    loadData();
  }, []);

  const showNotification = (msg: string) => {
    setStatusNotice(msg);
    toast.success(msg);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.category && it.category.trim()) set.add(it.category.trim());
    });
    return Array.from(set);
  }, [items]);

  const categoriesFilter = useMemo(() => {
    return ["الكل", ...existingCategories];
  }, [existingCategories]);

  const incompleteCount = useMemo(() => {
    return items.filter(isItemIncomplete).length;
  }, [items]);

  const missingImagesCount = useMemo(() => {
    return items.filter(isItemMissingImage).length;
  }, [items]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("بيانات غير مكتملة", "يرجى إدخال اسم الصنف أولاً.");
      return;
    }
    if (price === "" || Number(price) < 0) {
      toast.error("سعر غير صالح", "يرجى إدخال سعر بيع صحيح.");
      return;
    }

    const finalCategory = isCustomCategory && customCategory.trim()
      ? customCategory.trim()
      : category.trim() || "عام";

    const tempId = items.length > 0 ? Math.max(...items.map((it) => it.id)) + 1 : 1;

    const newItem: InventoryItem = {
      id: tempId,
      name: name.trim(),
      category: finalCategory,
      price: Number(price),
      wholesale_price: wholesalePrice !== "" ? Number(wholesalePrice) : undefined,
      wholesale_min_qty: wholesaleMinQty !== "" ? Number(wholesaleMinQty) : undefined,
      stock_count: 999,
      notes: notes.trim(),
      image: image.trim() || undefined,
      images: images.length > 0 ? images : undefined,
    };

    const updated = [newItem, ...items];
    setItems(updated);
    try {
      if (newItem.image) {
        const customMap = JSON.parse(localStorage.getItem("copycat_custom_images") || "{}");
        customMap[newItem.id] = { image: newItem.image, images: newItem.images || [newItem.image] };
        localStorage.setItem("copycat_custom_images", JSON.stringify(customMap));
      }
      localStorage.setItem("copycat_inventory_v8_local_catalog", JSON.stringify(updated));
    } catch {}

    setIsAddingModal(false);
    resetForm();
    showNotification("تم إضافة الصنف بنجاح!");

    if (isSupabaseConfigured) {
      try {
        await supabase.from("inventory").insert([newItem]);
      } catch (err) {
        console.warn("Supabase sync note:", err);
      }
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    if (existingCategories.includes(item.category)) {
      setCategory(item.category);
      setIsCustomCategory(false);
      setCustomCategory("");
    } else {
      setCategory("__NEW__");
      setIsCustomCategory(true);
      setCustomCategory(item.category);
    }
    setPrice(item.price);
    setWholesalePrice(item.wholesale_price !== undefined ? item.wholesale_price : "");
    setWholesaleMinQty(item.wholesale_min_qty !== undefined ? item.wholesale_min_qty : "");
    setNotes(item.notes || "");
    setImage(item.image || "");
    setImages(item.images || []);
    setAiDiscoveredImages([]);
    setShowAiPrompt(false);
    setAiDetectedName("");
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !name.trim() || price === "") return;

    const finalCategory = isCustomCategory && customCategory.trim()
      ? customCategory.trim()
      : category.trim() || "عام";

    const updatedItem: InventoryItem = {
      ...editingItem,
      name: name.trim(),
      category: finalCategory,
      price: Number(price),
      wholesale_price: wholesalePrice !== "" ? Number(wholesalePrice) : undefined,
      wholesale_min_qty: wholesaleMinQty !== "" ? Number(wholesaleMinQty) : undefined,
      stock_count: editingItem.stock_count || 999,
      notes: notes.trim(),
      image: image.trim() || undefined,
      images: images.length > 0 ? images : undefined,
    };

    const updatedList = items.map((it) => (it.id === editingItem.id ? updatedItem : it));
    setItems(updatedList);
    try {
      const customMap = JSON.parse(localStorage.getItem("copycat_custom_images") || "{}");
      customMap[editingItem.id] = {
        image: updatedItem.image || "",
        images: updatedItem.images || [],
      };
      localStorage.setItem("copycat_custom_images", JSON.stringify(customMap));
      localStorage.setItem("copycat_inventory_v8_local_catalog", JSON.stringify(updatedList));
    } catch {}

    setEditingItem(null);
    resetForm();
    showNotification("تم تحديث بيانات الصنف بنجاح!");

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from("inventory")
          .update({
            name: updatedItem.name,
            category: updatedItem.category,
            price: updatedItem.price,
            wholesale_price: updatedItem.wholesale_price,
            wholesale_min_qty: updatedItem.wholesale_min_qty,
            stock_count: updatedItem.stock_count,
            notes: updatedItem.notes,
          })
          .eq("id", editingItem.id);
      } catch (err) {
        console.warn("Supabase sync note:", err);
      }
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الصنف نهائياً من الكتالوج والمخزن؟")) return;
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    try {
      const customMap = JSON.parse(localStorage.getItem("copycat_custom_images") || "{}");
      delete customMap[id];
      localStorage.setItem("copycat_custom_images", JSON.stringify(customMap));
      localStorage.setItem("copycat_inventory_v8_local_catalog", JSON.stringify(updated));
    } catch {}
    showNotification("تم حذف الصنف.");

    if (isSupabaseConfigured) {
      try {
        await supabase.from("inventory").delete().eq("id", id);
      } catch (err) {
        console.warn("Supabase sync note:", err);
      }
    }
  };

  const resetForm = () => {
    setName("");
    setCategory(existingCategories[0] || "أدوات كتابة ورسم");
    setIsCustomCategory(false);
    setCustomCategory("");
    setPrice("");
    setWholesalePrice("");
    setWholesaleMinQty("");
    setNotes("");
    setImage("");
    setImages([]);
    setAiDiscoveredImages([]);
    setShowAiPrompt(false);
    setAiDetectedName("");
  };

  // Notify Engineer via WhatsApp for replenishment
  const handleNotifyEngineer = (item: InventoryItem) => {
    const textMsg = `طلب توريد من مكتبة كوبي كات:\nالمهندس المحترم، نرجو توريد صنف "${item.name}" (سعر البيع الحالي: ${item.price} ج.م).\nشكراً لتعاونكم الدائم.`;
    const url = `https://wa.me/${ENGINEER_PHONE_INTL}?text=${encodeURIComponent(textMsg)}`;
    const opened = safeOpenUrl(url);
    if (!opened) {
      toast.info(
        "تم إنشاء رابط الواتساب",
        "يرجى السماح بالنوافذ المنبثقة إذا لم يفتح المتصفح تطبيق واتساب تلقائياً."
      );
    }
  };

  // Calculations & Filtering with incomplete data handling and missing image filter
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (completionFilter === "complete" && isItemIncomplete(item)) return false;
      if (completionFilter === "incomplete" && !isItemIncomplete(item)) return false;
      if (completionFilter === "missing_image" && Boolean(item.image && item.image.trim().length > 0)) return false;

      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === "الكل" || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory, completionFilter]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalItemsCount = items.length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-2">
            <Boxes className="w-3.5 h-3.5" /> نظام حصر الكتالوج والمخزن لكوبي كات
          </div>
          <h1 className="text-2xl font-black text-white">إدارة أصناف ومنتجات وخدمات كوبي كات</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            أضف أو عدل أو احذف المنتجات والأسعار؛ ستظهر التحديثات فورياً في متجر الزبائن العام.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsAddingModal(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة صنف أو خدمة جديدة</span>
        </button>
      </div>

      {statusNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">إجمالي أصناف الكتالوج</span>
            <span className="text-2xl font-black text-white">{totalItemsCount} صنف</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">الأقسام والتصنيفات</span>
            <span className="text-2xl font-black text-cyan-400">{existingCategories.length} قسم</span>
          </div>
        </div>

        {/* Missing Images Queue Card */}
        <div
          onClick={() => {
            setCompletionFilter(completionFilter === "missing_image" ? "all" : "missing_image");
            setCurrentPage(1);
          }}
          className={`border rounded-2xl p-5 flex items-center gap-4 cursor-pointer transition ${
            missingImagesCount > 0
              ? "bg-purple-950/30 border-purple-500/40 hover:bg-purple-950/50"
              : "bg-slate-900 border-slate-800"
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            missingImagesCount > 0
              ? "bg-purple-500/20 border border-purple-500/30 text-purple-400"
              : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
          }`}>
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">بدون صورة (تحتاج تصوير)</span>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black ${missingImagesCount > 0 ? "text-purple-400" : "text-emerald-400"}`}>
                {missingImagesCount} صنف
              </span>
              {missingImagesCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  لوجو المتجر
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Incomplete Data Card */}
        <div
          onClick={() => {
            setCompletionFilter(completionFilter === "incomplete" ? "all" : "incomplete");
            setCurrentPage(1);
          }}
          className={`border rounded-2xl p-5 flex items-center gap-4 cursor-pointer transition ${
            incompleteCount > 0
              ? "bg-amber-950/30 border-amber-500/40 hover:bg-amber-950/50"
              : "bg-slate-900 border-slate-800"
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            incompleteCount > 0
              ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
              : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
          }`}>
            {incompleteCount > 0 ? <AlertTriangle className="w-6 h-6 animate-pulse" /> : <CheckCircle2 className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">أصناف ناقصة البيانات</span>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black ${incompleteCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {incompleteCount} صنف
              </span>
              {incompleteCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  مخفية عن الزبائن
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
            <input
              type="text"
              placeholder="بحث بالاسم أو التصنيف أو الملاحظات..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Category Dropdown Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="inventory-category-filter" className="text-xs text-slate-400 font-bold whitespace-nowrap">
                التصنيف:
              </label>
              <select
                id="inventory-category-filter"
                aria-label="تصفية المنتجات حسب التصنيف"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                {categoriesFilter.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Page size selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="inventory-page-size" className="text-xs text-slate-400 font-bold whitespace-nowrap">
                عرض:
              </label>
              <select
                id="inventory-page-size"
                aria-label="عدد الأصناف المعروضة في الصفحة"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value={20}>20 صنف</option>
                <option value={30}>30 صنف</option>
                <option value={50}>50 صنف</option>
                <option value={100}>100 صنف</option>
              </select>
            </div>
          </div>
        </div>

        {/* Completion Status Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <span className="text-xs font-bold text-slate-400 ml-1">تصفية العرض:</span>
          <button
            onClick={() => {
              setCompletionFilter("all");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              completionFilter === "all"
                ? "bg-blue-600 text-white shadow"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            جميع الأصناف ({items.length})
          </button>
          <button
            onClick={() => {
              setCompletionFilter("complete");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              completionFilter === "complete"
                ? "bg-emerald-600 text-white shadow"
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            المكتملة المعروضة للزبائن ({items.length - incompleteCount})
          </button>
          <button
            onClick={() => {
              setCompletionFilter("missing_image");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              completionFilter === "missing_image"
                ? "bg-purple-600 text-white font-black shadow"
                : "bg-slate-950 text-purple-400 hover:bg-purple-950/40 border border-purple-500/30"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>بدون صورة ({missingImagesCount} صنف)</span>
          </button>
          <button
            onClick={() => {
              setCompletionFilter("incomplete");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              completionFilter === "incomplete"
                ? "bg-amber-500 text-slate-950 font-black shadow"
                : "bg-slate-950 text-amber-400 hover:bg-amber-950/40 border border-amber-500/30"
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>بيانات ناقصة ({incompleteCount})</span>
          </button>
        </div>
      </div>

      {/* Pagination Top Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-2">
        <span>
          عرض الأصناف من {(currentPage - 1) * pageSize + 1} إلى {Math.min(currentPage * pageSize, filteredItems.length)} من إجمالي {filteredItems.length} صنف
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition cursor-pointer"
            title="الصفحة السابقة"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="font-bold text-white">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition cursor-pointer"
            title="الصفحة التالية"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Products Table (Stock count column removed as per requirement #3, incomplete items highlighted as per requirement #4) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3.5">اسم الصنف / الخدمة</th>
                <th className="p-3.5">التصنيف</th>
                <th className="p-3.5">سعر البيع للزبون</th>
                <th className="p-3.5">سعر الجملة والشرط</th>
                <th className="p-3.5">تفاصيل وملاحظات</th>
                <th className="p-3.5 text-center">الإجراءات والطلب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {paginatedItems.map((item) => {
                const incomplete = isItemIncomplete(item);
                const missingImg = !item.image || !item.image.trim();
                return (
                  <tr
                    key={item.id}
                    className={`transition ${
                      incomplete
                        ? "bg-amber-950/20 hover:bg-amber-950/35 border-r-4 border-amber-500"
                        : missingImg
                        ? "bg-purple-950/10 hover:bg-purple-950/25 border-r-4 border-purple-500/60"
                        : "hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="p-3.5 font-bold text-white">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              unoptimized
                              sizes="40px"
                              className="object-cover"
                              onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.src =
                                  "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80";
                              }}
                            />
                          ) : (
                            <Camera className="w-5 h-5 text-purple-400/70" />
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span>{item.name || "— بدون اسم —"}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {incomplete && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 w-fit">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                بيانات ناقصة (مخفي عن الزبون)
                              </span>
                            )}
                            {missingImg && (
                              <button
                                type="button"
                                onClick={() => handleEditItem(item)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 w-fit hover:bg-purple-500/30 cursor-pointer transition"
                                title="انقر لإضافة صورة للمنتج بالهاتف أو الكاميرا"
                              >
                                <Camera className="w-3 h-3 text-purple-400" />
                                <span>بدون صورة — اضغط للتصوير أو الرفع</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-blue-300 border border-slate-700 whitespace-nowrap">
                        {item.category || "غير محدد"}
                      </span>
                    </td>
                    <td className="p-3.5 font-black whitespace-nowrap">
                      {item.price && item.price > 0 ? (
                        <span className="text-emerald-400">{formatCurrency(item.price)}</span>
                      ) : (
                        <span className="text-amber-400 text-xs font-bold">⚠️ يلزم تحديد السعر</span>
                      )}
                    </td>
                    <td className="p-3.5 text-xs whitespace-nowrap">
                      {item.wholesale_price ? (
                        <span className="font-bold text-cyan-400">
                          {formatCurrency(item.wholesale_price)}
                          {item.wholesale_min_qty ? ` (من ${item.wholesale_min_qty} قطع)` : ""}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-3.5 text-xs text-slate-400 max-w-xs truncate">{item.notes || "—"}</td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Quick Camera action for missing image */}
                        {missingImg && (
                          <button
                            type="button"
                            onClick={() => handleEditItem(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-800/60 transition cursor-pointer"
                            title="إضافة صورة للمنتج بالهاتف أو الكاميرا"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>تصوير</span>
                          </button>
                        )}

                        {/* Supply order via WhatsApp */}
                        <button
                          onClick={() => handleNotifyEngineer(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/50 transition cursor-pointer"
                          title={`طلب توريد من البشمهندس (${ENGINEER_PHONE_LOCAL})`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>طلب توريد</span>
                        </button>

                        <button
                          onClick={() => handleEditItem(item)}
                          className="p-1.5 text-blue-400 hover:text-blue-300 rounded-lg hover:bg-blue-950/40 transition cursor-pointer"
                          title="تعديل بيانات الصنف"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-950/40 transition cursor-pointer"
                          title="حذف الصنف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 text-sm">
                    لا توجد أصناف تطابق معايير الفلترة الحالية
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Bottom Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition cursor-pointer"
          >
            الأولى
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition cursor-pointer"
          >
            السابق
          </button>
          <span className="px-3 py-1.5 text-xs font-bold text-white bg-slate-950 border border-slate-800 rounded-lg">
            صفحة {currentPage} من {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition cursor-pointer"
          >
            التالي
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition cursor-pointer"
          >
            الأخيرة
          </button>
        </div>
      )}

      {/* Add Modal */}
      {isAddingModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">إضافة صنف أو خدمة جديدة</h3>
              <button
                type="button"
                onClick={() => setIsAddingModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">اسم الصنف أو الخدمة:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: كشكول سلك A4 100 ورقة"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="add-item-category-select" className="text-xs font-bold text-slate-400 block mb-1">
                  التصنيف (اختر من القائمة لمنع الأخطاء):
                </label>
                <select
                  id="add-item-category-select"
                  aria-label="تحديد تصنيف الصنف"
                  value={isCustomCategory ? "__NEW__" : category}
                  onChange={(e) => {
                    if (e.target.value === "__NEW__") {
                      setIsCustomCategory(true);
                    } else {
                      setIsCustomCategory(false);
                      setCategory(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__NEW__">+ إضافة تصنيف جديد يدوي...</option>
                </select>

                {isCustomCategory && (
                  <input
                    type="text"
                    required
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="اكتب اسم التصنيف الجديد هنا..."
                    className="w-full mt-2 bg-slate-950 border border-blue-500/80 rounded-xl p-2.5 text-sm text-white focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">سعر البيع العادي (ج.م):</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Wholesale fields */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <label className="text-xs font-bold text-cyan-400 block mb-1">سعر الجملة (ج.م) [اختياري]:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value ? Number(e.target.value) : "")}
                    placeholder="مثال: 18.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-cyan-400 block mb-1">شرط كمية الجملة (القطع):</label>
                  <input
                    type="number"
                    value={wholesaleMinQty}
                    onChange={(e) => setWholesaleMinQty(e.target.value ? Number(e.target.value) : "")}
                    placeholder="مثال: 12"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">ملاحظات وتفاصيل الخدمة:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مقاس، خامة، تفاصيل العرض..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Product Images Management (Point 8 in edits2.0.md) */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>صور المنتج (الرئيسية والمعرض)</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    ضغط WebP مجاني 100%
                  </span>
                </div>

                {/* AI Image Assistant Banner & Discovered Results */}
                <div className="bg-gradient-to-r from-blue-950/70 via-indigo-950/60 to-purple-950/70 border border-blue-500/30 rounded-2xl p-3 space-y-2.5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                      <span className="text-xs font-bold text-blue-200">
                        مساعد الـ AI لجلب صور المنتج والمعرض
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAiImageSearch()}
                      disabled={isAiSearchingImages}
                      className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                    >
                      {isAiSearchingImages ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري البحث بالـ AI...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>بحث ذكي عن صور</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    اكتب اسم الصنف أو التقط له صورة بالهاتف؛ وسيقوم الـ AI بالتعرف عليه وجلب 3 صور إضافية عالية الجودة للمعرض بنقرة واحدة!
                  </p>

                  {/* Prompt when phone photo uploaded */}
                  {showAiPrompt && (
                    <div className="bg-blue-900/60 border border-blue-400/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                      <p className="text-xs text-blue-200 font-medium">
                        📸 تم رفع صورة للمنتج! هل ترغب بأن يبحث الـ AI عن 3 صور إضافية للمعرض؟
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAiImageSearch(image)}
                        disabled={isAiSearchingImages}
                        className="shrink-0 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg transition cursor-pointer"
                      >
                        نعم، ابحث الآن
                      </button>
                    </div>
                  )}

                  {/* AI Discovered Images Gallery */}
                  {aiDiscoveredImages.length > 0 && (
                    <div className="pt-1.5 space-y-2 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>الصور التي عثر عليها الـ AI ({aiDiscoveredImages.length}):</span>
                        </span>
                        <button
                          type="button"
                          onClick={applyAiImagesAll}
                          className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg shadow cursor-pointer transition"
                        >
                          ✓ تطبيق الكل (+3 صور للمعرض)
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {aiDiscoveredImages.map((imgUrl, aIdx) => (
                          <div key={aIdx} className="relative group rounded-xl overflow-hidden border border-blue-500/40 bg-slate-900 aspect-square">
                            <Image
                              src={imgUrl}
                              alt={`AI Suggestion ${aIdx + 1}`}
                              fill
                              unoptimized
                              sizes="80px"
                              className="object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80";
                              }}
                            />
                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 p-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setImage(imgUrl);
                                  toast.success("تم تعيين الصورة كرئيسية");
                                }}
                                className="text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded w-full text-center cursor-pointer"
                              >
                                رئيسية
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setImages((prev) => [...prev, imgUrl]);
                                  toast.success("تمت الإضافة للمعرض");
                                }}
                                className="text-[10px] font-bold bg-slate-700 hover:bg-slate-600 text-white px-2 py-0.5 rounded w-full text-center cursor-pointer"
                              >
                                + للمعرض
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Photo Pool Button */}
                <button
                  type="button"
                  onClick={openPoolPicker}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>اختيار من بنك صور فيسبوك والكاميرا ({poolPhotos.length || "150+"} صورة)</span>
                </button>

                {/* Main Image */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">الصورة الرئيسية للكارت:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMainImageUpload}
                      className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer"
                    />
                    {image && (
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                        <Image
                          src={image}
                          alt="Preview"
                          fill
                          unoptimized
                          sizes="36px"
                          className="object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setImage("")}
                          className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="أو ضع رابط مباشر للصورة (URL)..."
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
                  />
                </div>

                {/* Gallery Images */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">صور إضافية لمعرض التفاصيل (Gallery):</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleGalleryImagesUpload}
                    className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 file:cursor-pointer"
                  />

                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {images.map((imgUrl, gIdx) => (
                        <div key={gIdx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-800 group">
                          <Image
                            src={imgUrl}
                            alt={`Gallery ${gIdx + 1}`}
                            fill
                            unoptimized
                            sizes="48px"
                            className="object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setImages((prev) => prev.filter((_, i) => i !== gIdx))}
                            className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingModal(false)}
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition cursor-pointer"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">تعديل الصنف / الخدمة</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">اسم الصنف:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="edit-item-category-select" className="text-xs font-bold text-slate-400 block mb-1">
                  التصنيف:
                </label>
                <select
                  id="edit-item-category-select"
                  aria-label="تحديد تصنيف الصنف"
                  value={isCustomCategory ? "__NEW__" : category}
                  onChange={(e) => {
                    if (e.target.value === "__NEW__") {
                      setIsCustomCategory(true);
                    } else {
                      setIsCustomCategory(false);
                      setCategory(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__NEW__">+ إضافة تصنيف جديد يدوي...</option>
                </select>

                {isCustomCategory && (
                  <input
                    type="text"
                    required
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="اكتب اسم التصنيف الجديد هنا..."
                    className="w-full mt-2 bg-slate-950 border border-blue-500/80 rounded-xl p-2.5 text-sm text-white focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">سعر البيع العادي (ج.م):</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Wholesale fields */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <label className="text-xs font-bold text-cyan-400 block mb-1">سعر الجملة (ج.م) [اختياري]:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value ? Number(e.target.value) : "")}
                    placeholder="مثال: 18.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-cyan-400 block mb-1">شرط كمية الجملة (القطع):</label>
                  <input
                    type="number"
                    value={wholesaleMinQty}
                    onChange={(e) => setWholesaleMinQty(e.target.value ? Number(e.target.value) : "")}
                    placeholder="مثال: 12"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">الملاحظات:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Product Images Management in Edit Modal */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>صور المنتج (الرئيسية والمعرض)</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    ضغط WebP مجاني 100%
                  </span>
                </div>

                {/* AI Image Assistant Banner & Discovered Results */}
                <div className="bg-gradient-to-r from-blue-950/70 via-indigo-950/60 to-purple-950/70 border border-blue-500/30 rounded-2xl p-3 space-y-2.5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                      <span className="text-xs font-bold text-blue-200">
                        مساعد الـ AI لجلب صور المنتج والمعرض
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAiImageSearch()}
                      disabled={isAiSearchingImages}
                      className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                    >
                      {isAiSearchingImages ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري البحث بالـ AI...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>بحث ذكي عن صور</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    اكتب اسم الصنف أو التقط له صورة بالهاتف؛ وسيقوم الـ AI بالتعرف عليه وجلب 3 صور إضافية عالية الجودة للمعرض بنقرة واحدة!
                  </p>

                  {/* Prompt when phone photo uploaded */}
                  {showAiPrompt && (
                    <div className="bg-blue-900/60 border border-blue-400/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                      <p className="text-xs text-blue-200 font-medium">
                        📸 تم رفع صورة للمنتج! هل ترغب بأن يبحث الـ AI عن 3 صور إضافية للمعرض؟
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAiImageSearch(image)}
                        disabled={isAiSearchingImages}
                        className="shrink-0 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg transition cursor-pointer"
                      >
                        نعم، ابحث الآن
                      </button>
                    </div>
                  )}

                  {/* AI Discovered Images Gallery */}
                  {aiDiscoveredImages.length > 0 && (
                    <div className="pt-1.5 space-y-2 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>الصور التي عثر عليها الـ AI ({aiDiscoveredImages.length}):</span>
                        </span>
                        <button
                          type="button"
                          onClick={applyAiImagesAll}
                          className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg shadow cursor-pointer transition"
                        >
                          ✓ تطبيق الكل (+3 صور للمعرض)
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {aiDiscoveredImages.map((imgUrl, aIdx) => (
                          <div key={aIdx} className="relative group rounded-xl overflow-hidden border border-blue-500/40 bg-slate-900 aspect-square">
                            <Image
                              src={imgUrl}
                              alt={`AI Suggestion ${aIdx + 1}`}
                              fill
                              unoptimized
                              sizes="80px"
                              className="object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80";
                              }}
                            />
                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 p-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setImage(imgUrl);
                                  toast.success("تم تعيين الصورة كرئيسية");
                                }}
                                className="text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded w-full text-center cursor-pointer"
                              >
                                رئيسية
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setImages((prev) => [...prev, imgUrl]);
                                  toast.success("تمت الإضافة للمعرض");
                                }}
                                className="text-[10px] font-bold bg-slate-700 hover:bg-slate-600 text-white px-2 py-0.5 rounded w-full text-center cursor-pointer"
                              >
                                + للمعرض
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Photo Pool Button */}
                <button
                  type="button"
                  onClick={openPoolPicker}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>اختيار من بنك صور فيسبوك والكاميرا ({poolPhotos.length || "150+"} صورة)</span>
                </button>

                {/* Main Image */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">الصورة الرئيسية للكارت:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMainImageUpload}
                      className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer"
                    />
                    {image && (
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                        <Image
                          src={image}
                          alt="Preview"
                          fill
                          unoptimized
                          sizes="36px"
                          className="object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setImage("")}
                          className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="أو ضع رابط مباشر للصورة (URL)..."
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
                  />
                </div>

                {/* Gallery Images */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">صور إضافية لمعرض التفاصيل (Gallery):</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleGalleryImagesUpload}
                    className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 file:cursor-pointer"
                  />

                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {images.map((imgUrl, gIdx) => (
                        <div key={gIdx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-800 group">
                          <Image
                            src={imgUrl}
                            alt={`Gallery ${gIdx + 1}`}
                            fill
                            unoptimized
                            sizes="48px"
                            className="object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setImages((prev) => prev.filter((_, i) => i !== gIdx))}
                            className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Pool Selector Modal */}
      {showPoolPicker && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">بنك ومكتبة صور المنتجات</h3>
                  <p className="text-xs text-slate-400">اختر أي صورة لتعيينها للصنف أو إضافتها للمعرض بنقرة واحدة</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/photos"
                  target="_blank"
                  className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>إدارة البنك</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setShowPoolPicker(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/50">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث باسم الصورة..."
                  value={poolSearch}
                  onChange={(e) => setPoolSearch(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Photos Grid */}
            <div className="p-4 flex-1 overflow-y-auto">
              {isLoadingPool ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  <span>جاري تحميل الصور من البنك...</span>
                </div>
              ) : poolPhotos.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  لا توجد صور في البنك حالياً. يمكنك رفع صور من صفحة إدارة الصور.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {poolPhotos
                    .filter((p) => !poolSearch.trim() || p.filename.toLowerCase().includes(poolSearch.toLowerCase().trim()))
                    .map((p) => (
                      <div
                        key={p.id || p.filename}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col"
                      >
                        <Image
                          src={p.url}
                          alt={p.filename}
                          fill
                          sizes="120px"
                          className="object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1.5 p-2">
                          <button
                            type="button"
                            onClick={() => {
                              setImage(p.url);
                              toast.success("تم تعيين الصورة كرئيسية");
                              setShowPoolPicker(false);
                            }}
                            className="w-full py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow cursor-pointer"
                          >
                            ✓ كصورة رئيسية
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImages((prev) => [...prev, p.url]);
                              toast.success("تمت الإضافة لمعرض الصور");
                            }}
                            className="w-full py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold border border-slate-700 cursor-pointer"
                          >
                            + للمعرض
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-800 flex justify-end bg-slate-950">
              <button
                type="button"
                onClick={() => setShowPoolPicker(false)}
                className="px-4 py-1.5 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
