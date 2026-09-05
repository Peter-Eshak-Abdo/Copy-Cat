"use client";

import { useState, useEffect } from "react";
import {
  Boxes,
  Plus,
  Search,
  Trash2,
  Edit2,
  DollarSign,
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

interface InventoryItem {
  id: number;
  name: string;
  category: string;
  price: number;
  cost_price?: number;
  stock_count: number;
  notes?: string;
}

// Fallback initial items matching the original حصر.xlsx
const defaultItems: InventoryItem[] = [
  { id: 1, name: "ورق تصوير A4 دبل إيه 80 جم", category: "ورق", price: 220, stock_count: 45, notes: "باكو 500 ورقة" },
  { id: 2, name: "ورق كوشيه 300 جم A4", category: "ورق", price: 3.5, stock_count: 200, notes: "للبطاقات والشهادات" },
  { id: 3, name: "طباعة صورة شخصية 4x6 (عدد 4)", category: "خدمات تصوير", price: 25, stock_count: 999 },
  { id: 4, name: "طباعة وتغليف كارنيه/بطاقة وجهين A5", category: "خدمات بطاقات", price: 15, stock_count: 999 },
  { id: 5, name: "طباعة وتجهيز بحث أكاديمي (حتى 10 ورقات)", category: "خدمات طلابية", price: 35, stock_count: 999 },
  { id: 6, name: "قلم جاف أزرق روتو", category: "أدوات مكتبية", price: 7.5, stock_count: 120 },
  { id: 7, name: "ملف شفاف سوستة A4", category: "أدوات مكتبية", price: 12, stock_count: 80 },
];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>(defaultItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [isAddingModal, setIsAddingModal] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("عام");
  const [price, setPrice] = useState<number | "">("");
  const [stockCount, setStockCount] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  // Load from Supabase (with graceful offline/fallback state)
  useEffect(() => {
    async function loadData() {
      try {
        const { data, error } = await supabase
          .from("inventory")
          .select("*")
          .order("id", { ascending: true });

        if (!error && data && data.length > 0) {
          setItems(data);
        }
      } catch (e) {
        console.log("Using local initial inventory data");
      }
    }
    loadData();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price === "") return;

    const newItem: InventoryItem = {
      id: Date.now(),
      name: name.trim(),
      category: category.trim() || "عام",
      price: Number(price),
      stock_count: Number(stockCount) || 0,
      notes: notes.trim(),
    };

    // Optimistic local update
    setItems((prev) => [newItem, ...prev]);
    setIsAddingModal(false);
    resetForm();

    // Persist to Supabase if connected
    try {
      await supabase.from("inventory").insert([
        {
          name: newItem.name,
          category: newItem.category,
          price: newItem.price,
          stock_count: newItem.stock_count,
          notes: newItem.notes,
        },
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الصنف؟")) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await supabase.from("inventory").delete().eq("id", id);
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setName("");
    setCategory("عام");
    setPrice("");
    setStockCount("");
    setNotes("");
  };

  // Calculations
  const categories = ["الكل", ...Array.from(new Set(items.map((i) => i.category)))];
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "الكل" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalValue = items.reduce((acc, curr) => acc + curr.price * (curr.stock_count || 0), 0);
  const totalItemsCount = items.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold mb-2">
            <Boxes className="w-3.5 h-3.5" /> نظام حصر المخزن والأسعار (ERP / POS)
          </div>
          <h1 className="text-2xl font-bold text-white">إدارة أصناف ومستلزمات استوديو الطباعة</h1>
          <p className="text-slate-400 text-sm mt-1">
            بديل سحابي متطور لملف الإكسيل القديم، متصل بـ Supabase مع تتبع فوري لقيمة المخزن وأسعار الخدمات.
          </p>
        </div>

        <button
          onClick={() => setIsAddingModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة صنف أو خدمة جديدة</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">إجمالي الأصناف المسجلة</span>
            <span className="text-2xl font-extrabold text-white">{totalItemsCount}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">إجمالي القيمة التقديرية</span>
            <span className="text-2xl font-extrabold text-emerald-400">{formatCurrency(totalValue)}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">التصنيفات المتاحة</span>
            <span className="text-2xl font-extrabold text-purple-400">{categories.length - 1}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
          <input
            type="text"
            placeholder="بحث بالاسم أو التصنيف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-4">اسم الصنف / الخدمة</th>
                <th className="p-4">التصنيف</th>
                <th className="p-4">سعر البيع</th>
                <th className="p-4">الكمية المتوفرة</th>
                <th className="p-4">ملاحظات</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-4 font-semibold text-white">{item.name}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {item.category}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-emerald-400">
                    {formatCurrency(item.price)}
                  </td>
                  <td className="p-4">
                    <span
                      className={`font-semibold ${
                        item.stock_count < 10 && item.stock_count > 0
                          ? "text-amber-400"
                          : item.stock_count === 0
                          ? "text-red-400"
                          : "text-slate-300"
                      }`}
                    >
                      {item.stock_count}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-slate-400">{item.notes || "—"}</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-950/30 transition"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 text-sm">
                    لا توجد أصناف مطابقة للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {isAddingModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">إضافة صنف أو مستلزم جديد للمخزن</h3>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">اسم الصنف أو الخدمة:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: ورق كوشيه 250 جم"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">التصنيف:</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="مثال: ورق، أدوات"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">سعر البيع (ج.م):</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">الكمية المتوفرة:</label>
                <input
                  type="number"
                  value={stockCount}
                  onChange={(e) => setStockCount(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">ملاحظات إضافية:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مقاس، خامة، تفاصيل التوريد..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingModal(false)}
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
