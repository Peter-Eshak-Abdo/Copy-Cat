"use client";

import { useState, useEffect, useMemo } from "react";
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
  MessageSquareWarning,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { type InventoryItem, INITIAL_PRODUCTS } from "@/lib/inventory";

const ENGINEER_PHONE_INTL = "201206385464";
const ENGINEER_PHONE_LOCAL = "01206385464";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [isAddingModal, setIsAddingModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("أدوات كتابة ورسم");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [wholesalePrice, setWholesalePrice] = useState<number | "">("");
  const [wholesaleMinQty, setWholesaleMinQty] = useState<number | "">("");
  const [stockCount, setStockCount] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  // Load from Supabase with localStorage backup
  useEffect(() => {
    async function loadData() {
      try {
        // 1. Check localStorage first
        const saved = localStorage.getItem("copycat_inventory_v1_2") || localStorage.getItem("copycat_inventory");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length >= INITIAL_PRODUCTS.length) {
            setItems(parsed);
          } else {
            // Upgrade old cache
            setItems(INITIAL_PRODUCTS);
            localStorage.setItem("copycat_inventory_v1_2", JSON.stringify(INITIAL_PRODUCTS));
          }
        }

        // 2. Fetch from Supabase
        const { data, error } = await supabase
          .from("inventory")
          .select("*")
          .order("id", { ascending: true });

        if (!error && data && data.length > 0) {
          setItems(data);
          localStorage.setItem("copycat_inventory_v1_2", JSON.stringify(data));
        }
      } catch {
        console.log("Using local cache for inventory data");
      }
    }
    loadData();
  }, []);

  const showNotification = (msg: string) => {
    setStatusNotice(msg);
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


  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price === "") return;

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
      stock_count: Number(stockCount) || 0,
      notes: notes.trim(),
    };

    const updated = [newItem, ...items];
    setItems(updated);
    try {
      localStorage.setItem("copycat_inventory_v1_2", JSON.stringify(updated));
    } catch {}

    setIsAddingModal(false);
    resetForm();
    showNotification("تم إضافة الصنف بنجاح!");

    try {
      const { data, error } = await supabase
        .from("inventory")
        .insert([
          {
            name: newItem.name,
            category: newItem.category,
            price: newItem.price,
            wholesale_price: newItem.wholesale_price,
            wholesale_min_qty: newItem.wholesale_min_qty,
            stock_count: newItem.stock_count,
            notes: newItem.notes,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        setItems((prev) => {
          const synced = prev.map((it) => (it.id === tempId ? (data as InventoryItem) : it));
          try {
            localStorage.setItem("copycat_inventory_v1_2", JSON.stringify(synced));
          } catch {}
          return synced;
        });
      }
    } catch (err) {
      console.warn("Supabase sync note:", err);
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
    setStockCount(item.stock_count);
    setNotes(item.notes || "");
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
      stock_count: Number(stockCount) || 0,
      notes: notes.trim(),
    };

    const updatedList = items.map((it) => (it.id === editingItem.id ? updatedItem : it));
    setItems(updatedList);
    try {
      localStorage.setItem("copycat_inventory_v1_2", JSON.stringify(updatedList));
    } catch {}

    setEditingItem(null);
    resetForm();
    showNotification("تم تحديث بيانات الصنف بنجاح!");

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
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الصنف نهائياً من الكتالوج والمخزن؟")) return;
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    try {
      localStorage.setItem("copycat_inventory_v1_2", JSON.stringify(updated));
    } catch {}
    showNotification("تم حذف الصنف.");

    try {
      await supabase.from("inventory").delete().eq("id", id);
    } catch (err) {
      console.warn("Supabase sync note:", err);
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
    setStockCount("");
    setNotes("");
  };

  // Notify Engineer via WhatsApp
  const handleNotifyEngineer = (item: InventoryItem) => {
    const statusText = item.stock_count <= 0 ? "نفد بالكامل من المخزن" : `قارب على النفاد (الكمية المتبقية: ${item.stock_count})`;
    const textMsg = `تنبيه مخزون من مكتبة كوبي كات:\nالمهندس المحترم، صنف "${item.name}" ${statusText}.\nيرجى تجهيز وشراء كمية جديدة للمخزن.`;
    const url = `https://wa.me/${ENGINEER_PHONE_INTL}?text=${encodeURIComponent(textMsg)}`;
    window.open(url, "_blank");
  };

  // Calculations & Filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === "الكل" || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

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

      {/* Stats Cards: Note: Estimated total value card removed as per requirement #5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">إجمالي الأصناف بالمخزن</span>
            <span className="text-2xl font-black text-white">{totalItemsCount} صنف</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold block">الأقسام والتصنيفات النشطة</span>
            <span className="text-2xl font-black text-purple-400">{existingCategories.length} قسم</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
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
            <span className="text-xs text-slate-400 font-bold whitespace-nowrap">التصنيف:</span>
            <select
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
            <span className="text-xs text-slate-400 font-bold whitespace-nowrap">عرض:</span>
            <select
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

      {/* Products Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3.5">اسم الصنف / الخدمة</th>
                <th className="p-3.5">التصنيف</th>
                <th className="p-3.5">سعر البيع للزبون</th>
                <th className="p-3.5">سعر الجملة والشرط</th>
                <th className="p-3.5">الكمية بالمخزن</th>
                <th className="p-3.5">تفاصيل وملاحظات</th>
                <th className="p-3.5 text-center">الإجراءات وتنبيه المهندس</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {paginatedItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3.5 font-bold text-white">{item.name}</td>
                  <td className="p-3.5">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-blue-300 border border-slate-700 whitespace-nowrap">
                      {item.category}
                    </span>
                  </td>
                  <td className="p-3.5 font-black text-emerald-400 whitespace-nowrap">
                    {formatCurrency(item.price)}
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
                  <td className="p-3.5">
                    <span
                      className={`font-black px-2 py-0.5 rounded-lg text-xs ${
                        item.stock_count <= 0
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : item.stock_count < 15
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {item.stock_count}
                    </span>
                  </td>
                  <td className="p-3.5 text-xs text-slate-400 max-w-xs truncate">{item.notes || "—"}</td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Notify Engineer Button via WhatsApp */}
                      <button
                        onClick={() => handleNotifyEngineer(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/50 transition cursor-pointer"
                        title={`إشعار البشمهندس بنفاد أو قرب انتهاء الصنف (${ENGINEER_PHONE_LOCAL})`}
                      >
                        <MessageSquareWarning className="w-3.5 h-3.5" />
                        <span>إشعار نفاد</span>
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
                        title="حذف من المخزن"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 text-sm">
                    لا توجد أصناف تطابق نتائج البحث الحالية
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
                <label className="text-xs font-bold text-slate-400 block mb-1">التصنيف (اختر من القائمة لمنع الأخطاء):</label>
                <select
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

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">الكمية المتوفرة:</label>
                  <input
                    type="number"
                    value={stockCount}
                    onChange={(e) => setStockCount(e.target.value ? Number(e.target.value) : "")}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
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
                <label className="text-xs font-bold text-slate-400 block mb-1">التصنيف:</label>
                <select
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

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">الكمية المتوفرة:</label>
                  <input
                    type="number"
                    value={stockCount}
                    onChange={(e) => setStockCount(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
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
    </div>
  );
}
