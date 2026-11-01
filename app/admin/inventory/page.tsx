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
  Image as ImageIcon,
  Loader2,
  Sparkles,
  RefreshCw,
  Camera,
  ExternalLink,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { formatCurrency, safeOpenUrl, compressImageToWebP, openWhatsAppChat } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { type InventoryItem, INITIAL_PRODUCTS, sanitizeItem } from "@/lib/inventory";
import { SITE_CONFIG } from "@/lib/site-config";

const ENGINEER_PHONE_INTL = SITE_CONFIG.engineer.phoneIntl;
const ENGINEER_PHONE_LOCAL = SITE_CONFIG.engineer.phone;

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
  const [, setIsUploadingImage] = useState(false);

  // AI Product Images Assistant State
  const [isAiSearchingImages, setIsAiSearchingImages] = useState(false);
  const [aiDiscoveredImages, setAiDiscoveredImages] = useState<string[]>([]);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [, setAiDetectedName] = useState("");

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
      toast.error("الصور مظهرتش", "جرب تاني");
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
        "الصورة الأساسية اتحطت",
        "عايز الذكاء الاصطناعي يدوّر على 3 صور زيادة للمنتج؟"
      );
    } catch {
      toast.error("الصورة مفتحتش", "جرب صورة تانية.");
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
      toast.success("الصور اتضافت", `${compressedList.length} صورة زيادة.`);
    } catch {
      toast.error("في صور مفتحتش", "جرب تاني.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // AI Product Image Search Action
  const handleAiImageSearch = async (providedImage?: string) => {
    const targetImage = providedImage || (image.startsWith("data:") ? image : undefined);
    const targetName = name.trim();
    if (!targetName && !targetImage) {
      toast.error("في حاجة ناقصة", "اكتب اسم المنتج أو صوّره الأول عشان الذكاء الاصطناعي يدوّر.");
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
          "لقينا صور",
          `${data.allImages.length} صورة للمنتج.`
        );
      } else {
        toast.info("ملقيناش صور", "جرب تكتب اسم المنتج بطريقة تانية.");
      }
    } catch {
      toast.error("مقدرناش ندوّر", "جرب تاني بعد شوية.");
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
    toast.success("الصور اتحطت", "الصورة الأساسية والصور الزيادة اتحطوا على المنتج.");
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
      toast.error("في حاجة ناقصة", "اكتب اسم المنتج.");
      return;
    }
    if (price === "" || Number(price) < 0) {
      toast.error("السعر غلط", "اكتب سعر البيع.");
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
    showNotification("المنتج اتضاف");

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
    showNotification("المنتج اتعدل");

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
    if (!confirm("متأكد إنك عايز تمسح المنتج ده خالص؟")) return;
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    try {
      const customMap = JSON.parse(localStorage.getItem("copycat_custom_images") || "{}");
      delete customMap[id];
      localStorage.setItem("copycat_custom_images", JSON.stringify(customMap));
      localStorage.setItem("copycat_inventory_v8_local_catalog", JSON.stringify(updated));
    } catch {}
    showNotification("المنتج اتمسح");

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
    const opened = openWhatsAppChat(ENGINEER_PHONE_INTL, textMsg);
    if (!opened) {
      toast.info(
        "بنفتح واتساب",
        "لو واتساب مفتحش، اسمح للموقع يفتح نوافذ جديدة (Pop-ups)."
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
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-800">المنتجات والمخزن</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">
            {totalItemsCount} صنف
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/photos"
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition"
          >
            <Camera className="w-4 h-4 text-emerald-600" />
            <span>الصور</span>
          </Link>

          <button
            onClick={() => {
              resetForm();
              setIsAddingModal(true);
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ضيف منتج</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block">كل المنتجات</span>
            <span className="text-2xl font-black text-slate-900">{totalItemsCount} صنف</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 text-cyan-700 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block">الأقسام</span>
            <span className="text-2xl font-black text-cyan-700">{existingCategories.length} قسم</span>
          </div>
        </div>

        {/* Missing Images Queue Card */}
        <div
          onClick={() => {
            setCompletionFilter(completionFilter === "missing_image" ? "all" : "missing_image");
            setCurrentPage(1);
          }}
          className={`border rounded-2xl p-5 flex items-center gap-4 cursor-pointer transition shadow-xs ${
            missingImagesCount > 0
              ? "bg-purple-50/60 border-purple-200 hover:bg-purple-50"
              : "bg-white border-slate-200"
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            missingImagesCount > 0
              ? "bg-purple-100 text-purple-700"
              : "bg-emerald-50 text-emerald-600"
          }`}>
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block">من غير صورة (محتاجة تتصور)</span>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black ${missingImagesCount > 0 ? "text-purple-700" : "text-emerald-700"}`}>
                {missingImagesCount} صنف
              </span>
              {missingImagesCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
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
          className={`border rounded-2xl p-5 flex items-center gap-4 cursor-pointer transition shadow-xs ${
            incompleteCount > 0
              ? "bg-amber-50/60 border-amber-200 hover:bg-amber-50"
              : "bg-white border-slate-200"
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            incompleteCount > 0
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-50 text-emerald-600"
          }`}>
            {incompleteCount > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block">ناقصها بيانات</span>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black ${incompleteCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {incompleteCount} صنف
              </span>
              {incompleteCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  مش ظاهرة للزباين
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="دوّر بالاسم أو القسم..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Category Dropdown Filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="inventory-category-filter" className="text-xs text-slate-500 font-bold whitespace-nowrap">
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
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer transition"
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
              <label htmlFor="inventory-page-size" className="text-xs text-slate-500 font-bold whitespace-nowrap">
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
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer transition"
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
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-400 ml-1">وريني:</span>
          <button
            onClick={() => {
              setCompletionFilter("all");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              completionFilter === "all"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
          >
            الكل ({items.length})
          </button>
          <button
            onClick={() => {
              setCompletionFilter("complete");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              completionFilter === "complete"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
          >
            الظاهرة للزباين ({items.length - incompleteCount})
          </button>
          <button
            onClick={() => {
              setCompletionFilter("missing_image");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              completionFilter === "missing_image"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>من غير صورة ({missingImagesCount})</span>
          </button>
          <button
            onClick={() => {
              setCompletionFilter("incomplete");
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              completionFilter === "incomplete"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>ناقصها بيانات ({incompleteCount})</span>
          </button>
        </div>
      </div>

      {/* Pagination Top Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-2">
        <span>
          عرض الأصناف من {(currentPage - 1) * pageSize + 1} إلى {Math.min(currentPage * pageSize, filteredItems.length)} من إجمالي {filteredItems.length} صنف
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-40 hover:bg-slate-200 transition cursor-pointer border border-slate-200"
            title="اللي قبلها"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="font-bold text-slate-800">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-40 hover:bg-slate-200 transition cursor-pointer border border-slate-200"
            title="اللي بعدها"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">المنتج / الخدمة</th>
                <th className="p-3.5">القسم</th>
                <th className="p-3.5">سعر البيع</th>
                <th className="p-3.5">سعر الجملة</th>
                <th className="p-3.5">ملاحظات</th>
                <th className="p-3.5 text-center">تعديل وطلب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {paginatedItems.map((item) => {
                const incomplete = isItemIncomplete(item);
                const missingImg = !item.image || !item.image.trim();
                return (
                  <tr
                    key={item.id}
                    className={`transition ${
                      incomplete
                        ? "bg-amber-50/50 hover:bg-amber-100/40 border-r-4 border-amber-500"
                        : missingImg
                        ? "bg-purple-50/30 hover:bg-purple-100/30 border-r-4 border-purple-400"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td className="p-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
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
                            <Camera className="w-5 h-5 text-purple-500" />
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span>{item.name || "— من غير اسم —"}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {incomplete && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 w-fit">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                ناقصه بيانات (الزبون مش شايفه)
                              </span>
                            )}
                            {missingImg && (
                              <button
                                type="button"
                                onClick={() => handleEditItem(item)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 w-fit hover:bg-purple-200 cursor-pointer transition"
                                title="دوس عشان تصوّر المنتج أو ترفع صورته"
                              >
                                <Camera className="w-3 h-3 text-purple-600" />
                                <span>من غير صورة — دوس وصوّره</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                        {item.category || "من غير قسم"}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold whitespace-nowrap">
                      {item.price && item.price > 0 ? (
                        <span className="text-emerald-700">{formatCurrency(item.price)}</span>
                      ) : (
                        <span className="text-amber-700 text-xs font-bold">⚠️ اكتب السعر</span>
                      )}
                    </td>
                    <td className="p-3.5 text-xs whitespace-nowrap">
                      {item.wholesale_price ? (
                        <span className="font-bold text-cyan-700">
                          {formatCurrency(item.wholesale_price)}
                          {item.wholesale_min_qty ? ` (من ${item.wholesale_min_qty} قطع)` : ""}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3.5 text-xs text-slate-500 max-w-xs truncate">{item.notes || "—"}</td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Quick Camera action for missing image */}
                        {missingImg && (
                          <button
                            type="button"
                            onClick={() => handleEditItem(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200 transition cursor-pointer"
                            title="صوّر المنتج"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>صوّر</span>
                          </button>
                        )}

                        {/* Supply order via WhatsApp */}
                        <button
                          onClick={() => handleNotifyEngineer(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer"
                          title={`طلب توريد من البشمهندس (${ENGINEER_PHONE_LOCAL})`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>اطلبه من المورد</span>
                        </button>

                        <button
                          onClick={() => handleEditItem(item)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                          title="عدّل المنتج"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50 transition cursor-pointer"
                          title="امسح المنتج"
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
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                    مفيش منتجات كده
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
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 disabled:opacity-40 hover:bg-slate-200 transition cursor-pointer"
          >
            الأولى
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 disabled:opacity-40 hover:bg-slate-200 transition cursor-pointer"
          >
            السابق
          </button>
          <span className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-xs">
            صفحة {currentPage} من {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 disabled:opacity-40 hover:bg-slate-200 transition cursor-pointer"
          >
            التالي
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 disabled:opacity-40 hover:bg-slate-200 transition cursor-pointer"
          >
            الأخيرة
          </button>
        </div>
      )}

      {/* Add Modal */}
      {isAddingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">منتج أو خدمة جديدة</h3>
              <button
                type="button"
                onClick={() => setIsAddingModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الاسم:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثلاً: كشكول سلك A4 100 ورقة"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="add-item-category-select" className="text-xs font-bold text-slate-700 block mb-1">
                  القسم (اختاره من القايمة):
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none cursor-pointer transition"
                >
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__NEW__">+ قسم جديد...</option>
                </select>

                {isCustomCategory && (
                  <input
                    type="text"
                    required
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="اسم القسم الجديد..."
                    className="w-full mt-2 bg-slate-50 border border-blue-500 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none transition"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">سعر البيع (ج.م):</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              {/* Wholesale fields */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-cyan-800 block mb-1">سعر الجملة (ج.م):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value ? Number(e.target.value) : "")}
                    placeholder="مثلاً: 18"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-cyan-800 block mb-1">الجملة من كام قطعة:</label>
                  <input
                    type="number"
                    value={wholesaleMinQty}
                    onChange={(e) => setWholesaleMinQty(e.target.value ? Number(e.target.value) : "")}
                    placeholder="مثلاً: 12"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="المقاس، الخامة، العرض..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              {/* Product Images Management */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>صور المنتج</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    صور خفيفة
                  </span>
                </div>

                {/* AI Image Assistant Banner & Discovered Results */}
                <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3 space-y-2.5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-xs font-bold text-blue-900">
                        خلّي الذكاء الاصطناعي يجيب صور للمنتج
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAiImageSearch()}
                      disabled={isAiSearchingImages}
                      className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {isAiSearchingImages ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>بندوّر...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>دوّر على صور</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    اكتب اسم المنتج أو صوّره بالموبايل، والذكاء الاصطناعي هيعرفه ويجيبله صور.
                  </p>

                  {/* Prompt when phone photo uploaded */}
                  {showAiPrompt && (
                    <div className="bg-white border border-blue-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs">
                      <p className="text-xs text-blue-900 font-medium">
                        📸 الصورة اترفعت. عايز الذكاء الاصطناعي يدوّر على 3 صور زيادة؟
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAiImageSearch(image)}
                        disabled={isAiSearchingImages}
                        className="shrink-0 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg transition cursor-pointer shadow-xs"
                      >
                        أيوه، دوّر
                      </button>
                    </div>
                  )}

                  {/* AI Discovered Images Gallery */}
                  {aiDiscoveredImages.length > 0 && (
                    <div className="pt-1.5 space-y-2 border-t border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>الصور اللي لقيناها ({aiDiscoveredImages.length}):</span>
                        </span>
                        <button
                          type="button"
                          onClick={applyAiImagesAll}
                          className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg shadow-xs cursor-pointer transition"
                        >
                          ✓ حطهم كلهم
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {aiDiscoveredImages.map((imgUrl, aIdx) => (
                          <div key={aIdx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square shadow-xs">
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
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 p-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setImage(imgUrl);
                                  toast.success("بقت الصورة الأساسية");
                                }}
                                className="text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded w-full text-center cursor-pointer"
                              >
                                أساسية
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setImages((prev) => [...prev, imgUrl]);
                                  toast.success("اتضافت");
                                }}
                                className="text-[10px] font-bold bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded w-full text-center cursor-pointer"
                              >
                                + صورة زيادة
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
                  className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>اختار من الصور المتسجلة ({poolPhotos.length || "150+"} صورة)</span>
                </button>

                {/* Main Image */}
                <div>
                  <label className="text-[11px] text-slate-600 font-bold block mb-1">الصورة الأساسية:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMainImageUpload}
                      className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
                    />
                    {image && (
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-200 shrink-0 shadow-xs">
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
                    placeholder="أو الزق رابط الصورة..."
                    className="w-full mt-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Gallery Images */}
                <div>
                  <label className="text-[11px] text-slate-600 font-bold block mb-1">صور زيادة:</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleGalleryImagesUpload}
                    className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 file:cursor-pointer border border-slate-200 rounded-xl p-1"
                  />

                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {images.map((imgUrl, gIdx) => (
                        <div key={gIdx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 group shadow-xs">
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
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
                >
                  احفظ المنتج
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">عدّل المنتج</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الاسم:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="edit-item-category-select" className="text-xs font-bold text-slate-700 block mb-1">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none cursor-pointer transition"
                >
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__NEW__">+ قسم جديد...</option>
                </select>

                {isCustomCategory && (
                  <input
                    type="text"
                    required
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="اسم القسم الجديد..."
                    className="w-full mt-2 bg-slate-50 border border-blue-500 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none transition"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">سعر البيع (ج.م):</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              {/* Wholesale fields */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-cyan-800 block mb-1">سعر الجملة (ج.م):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value ? Number(e.target.value) : "")}
                    placeholder="مثلاً: 18"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-cyan-800 block mb-1">الجملة من كام قطعة:</label>
                  <input
                    type="number"
                    value={wholesaleMinQty}
                    onChange={(e) => setWholesaleMinQty(e.target.value ? Number(e.target.value) : "")}
                    placeholder="مثلاً: 12"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الملاحظات:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              {/* Product Images Management in Edit Modal */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>صور المنتج</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    صور خفيفة
                  </span>
                </div>

                {/* AI Image Assistant Banner & Discovered Results */}
                <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3 space-y-2.5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-xs font-bold text-blue-900">
                        خلّي الذكاء الاصطناعي يجيب صور للمنتج
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAiImageSearch()}
                      disabled={isAiSearchingImages}
                      className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {isAiSearchingImages ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>بندوّر...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" />
                          <span>دوّر على صور</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    اكتب اسم المنتج أو صوّره بالموبايل، والذكاء الاصطناعي هيعرفه ويجيبله صور.
                  </p>

                  {/* Prompt when phone photo uploaded */}
                  {showAiPrompt && (
                    <div className="bg-white border border-blue-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs">
                      <p className="text-xs text-blue-900 font-medium">
                        📸 الصورة اترفعت. عايز الذكاء الاصطناعي يدوّر على 3 صور زيادة؟
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAiImageSearch(image)}
                        disabled={isAiSearchingImages}
                        className="shrink-0 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg transition cursor-pointer shadow-xs"
                      >
                        أيوه، دوّر
                      </button>
                    </div>
                  )}

                  {/* AI Discovered Images Gallery */}
                  {aiDiscoveredImages.length > 0 && (
                    <div className="pt-1.5 space-y-2 border-t border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>الصور اللي لقيناها ({aiDiscoveredImages.length}):</span>
                        </span>
                        <button
                          type="button"
                          onClick={applyAiImagesAll}
                          className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg shadow-xs cursor-pointer transition"
                        >
                          ✓ حطهم كلهم
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {aiDiscoveredImages.map((imgUrl, aIdx) => (
                          <div key={aIdx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square shadow-xs">
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
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 p-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setImage(imgUrl);
                                  toast.success("بقت الصورة الأساسية");
                                }}
                                className="text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded w-full text-center cursor-pointer"
                              >
                                أساسية
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setImages((prev) => [...prev, imgUrl]);
                                  toast.success("اتضافت");
                                }}
                                className="text-[10px] font-bold bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded w-full text-center cursor-pointer"
                              >
                                + صورة زيادة
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
                  className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>اختار من الصور المتسجلة ({poolPhotos.length || "150+"} صورة)</span>
                </button>

                {/* Main Image */}
                <div>
                  <label className="text-[11px] text-slate-600 font-bold block mb-1">الصورة الأساسية:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMainImageUpload}
                      className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
                    />
                    {image && (
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-200 shrink-0 shadow-xs">
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
                    placeholder="أو الزق رابط الصورة..."
                    className="w-full mt-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Gallery Images */}
                <div>
                  <label className="text-[11px] text-slate-600 font-bold block mb-1">صور زيادة:</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleGalleryImagesUpload}
                    className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 file:cursor-pointer border border-slate-200 rounded-xl p-1"
                  />

                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {images.map((imgUrl, gIdx) => (
                        <div key={gIdx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 group shadow-xs">
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
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>احفظ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Pool Selector Modal */}
      {showPoolPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">صور المنتجات</h3>
                  <p className="text-xs text-slate-500">اختار صورة وحطها على المنتج</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/photos"
                  target="_blank"
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <span>كل الصور</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setShowPoolPicker(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="دوّر باسم الصورة..."
                  value={poolSearch}
                  onChange={(e) => setPoolSearch(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Photos Grid */}
            <div className="p-4 flex-1 overflow-y-auto">
              {isLoadingPool ? (
                <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span>بنجيب الصور...</span>
                </div>
              ) : poolPhotos.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  مفيش صور لسه. ارفع صور من صفحة صور المنتجات.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {poolPhotos
                    .filter((p) => !poolSearch.trim() || p.filename.toLowerCase().includes(poolSearch.toLowerCase().trim()))
                    .map((p) => (
                      <div
                        key={p.id || p.filename}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex flex-col shadow-xs"
                      >
                        <Image
                          src={p.url}
                          alt={p.filename}
                          fill
                          sizes="120px"
                          className="object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1.5 p-2">
                          <button
                            type="button"
                            onClick={() => {
                              setImage(p.url);
                              toast.success("بقت الصورة الأساسية");
                              setShowPoolPicker(false);
                            }}
                            className="w-full py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-xs cursor-pointer"
                          >
                            ✓ أساسية
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImages((prev) => [...prev, p.url]);
                              toast.success("اتضافت");
                            }}
                            className="w-full py-1 rounded bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold cursor-pointer"
                          >
                            + صورة زيادة
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 flex justify-end bg-slate-50">
              <button
                type="button"
                onClick={() => setShowPoolPicker(false)}
                className="px-4 py-1.5 text-xs rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 cursor-pointer"
              >
                اقفل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
