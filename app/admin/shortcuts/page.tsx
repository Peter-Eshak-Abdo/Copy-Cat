"use client";

import { useState, useMemo } from "react";
import {
  Bookmark,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  Search,
  Globe,
  X,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { safeOpenUrl } from "@/lib/utils";
import {
  WebShortcut,
  INITIAL_SHORTCUTS,
  DEFAULT_SHORTCUT_CATEGORIES,
} from "@/lib/shortcuts-data";

const STORAGE_KEY = "copycat_web_shortcuts_v1";

export default function ShortcutsPage() {
  const { toast } = useToast();
  const [shortcuts, setShortcuts] = useState<WebShortcut[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    return INITIAL_SHORTCUTS;
  });
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<WebShortcut | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("خدمات حكومية وبطاقات");
  const [description, setDescription] = useState("");

  // Save to local storage
  const persistShortcuts = (items: WebShortcut[]) => {
    setShortcuts(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  };

  // Categories list
  const categories = useMemo(() => {
    const custom = Array.from(new Set(shortcuts.map((s) => s.category).filter(Boolean)));
    const merged = Array.from(new Set([...DEFAULT_SHORTCUT_CATEGORIES, ...custom]));
    return merged;
  }, [shortcuts]);

  // Filtered Shortcuts
  const filteredShortcuts = useMemo(() => {
    return shortcuts.filter((sc) => {
      const matchesSearch =
        sc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sc.description && sc.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        sc.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "الكل" || sc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [shortcuts, searchQuery, selectedCategory]);

  const openAddModal = () => {
    setEditingShortcut(null);
    setTitle("");
    setUrl("");
    setCategory("خدمات حكومية وبطاقات");
    setDescription("");
    setIsModalOpen(true);
  };

  const openEditModal = (sc: WebShortcut) => {
    setEditingShortcut(sc);
    setTitle(sc.title);
    setUrl(sc.url);
    setCategory(sc.category);
    setDescription(sc.description || "");
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      toast.error("بيانات غير مكتملة", "يرجى كتابة اسم الموقع والرابط.");
      return;
    }

    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = `https://${cleanUrl}`;
    }

    if (editingShortcut) {
      const updated = shortcuts.map((sc) =>
        sc.id === editingShortcut.id
          ? {
              ...sc,
              title: title.trim(),
              url: cleanUrl,
              category: category.trim(),
              description: description.trim(),
            }
          : sc
      );
      persistShortcuts(updated);
      toast.success("تم تحديث الموقع بنجاح");
    } else {
      const newSc: WebShortcut = {
        id: `sc-${Date.now()}`,
        title: title.trim(),
        url: cleanUrl,
        category: category.trim() || "خدمات عامة",
        description: description.trim(),
      };
      persistShortcuts([newSc, ...shortcuts]);
      toast.success("تمت إضافة الموقع بنجاح");
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const filtered = shortcuts.filter((sc) => sc.id !== id);
    persistShortcuts(filtered);
    toast.success("تم حذف الموقع من الاختصارات");
  };

  const handleOpenLink = (urlToOpen: string) => {
    const success = safeOpenUrl(urlToOpen);
    if (!success) {
      window.location.assign(urlToOpen);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-linear-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 p-6 rounded-3xl border border-blue-500/20 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-2">
            <Bookmark className="w-3.5 h-3.5" /> مركز اختصارات ومواقع العمل السريعة
          </div>
          <h1 className="text-2xl font-black text-white">دليل وروابط المواقع اليومية</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
            مواقع التقديمات والجامعات، الخدمات الحكومية، أدوات التصميم وعزل الصور، ومواقع المذكرات
            المحفوظة لسرعة الوصول إليها وتوفير وقت البحث.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-blue-600/30 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة موقع جديد</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="بحث باسم الموقع أو الوصف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs sm:text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <span className="text-xs text-slate-400 font-bold">
            عدد المواقع: {filteredShortcuts.length}
          </span>
        </div>

        {/* Categories Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white shadow"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Shortcuts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredShortcuts.map((sc) => (
          <div
            key={sc.id}
            className="group bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between gap-4"
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-sm group-hover:text-blue-400 transition">
                      {sc.title}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 block w-fit mt-1">
                      {sc.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                  <button
                    onClick={() => openEditModal(sc)}
                    className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                    title="تعديل الموقع"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(sc.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                    title="حذف الموقع"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {sc.description && (
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {sc.description}
                </p>
              )}
            </div>

            <button
              onClick={() => handleOpenLink(sc.url)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-950 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-800 hover:border-blue-500 text-xs font-bold transition cursor-pointer group/btn"
            >
              <span>فتح الموقع الآن</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          </div>
        ))}

        {filteredShortcuts.length === 0 && (
          <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
            لا توجد مواقع تطابق عملية البحث الحالية
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingShortcut ? "تعديل بيانات الموقع" : "إضافة موقع جديد إلى الاختصارات"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">اسم الموقع:</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: منصة التنسيق الإلكتروني"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">رابط الموقع (URL):</label>
                <input
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">التصنيف:</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="مثال: خدمات حكومية، تقديمات، تصميم"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">وصف أو ملاحظات:</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اكتب ملاحظة تفيد زملاء العمل عند فتح هذا الموقع..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  حفظ الموقع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
