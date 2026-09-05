"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  Phone,
  Clock,
  MapPin,
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  CheckCircle2,
  ExternalLink,
  Zap,
  ShoppingBag,
  Boxes,
  ArrowRight,
  MessageCircle,
  X,
  Share2,
} from "lucide-react";
import confetti from "canvas-confetti";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { formatCurrency, safeOpenUrl } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { ThemeToggle } from "@/components/theme-provider";
import { INITIAL_PRODUCTS, type InventoryItem } from "@/lib/inventory";

const WHATSAPP_NUMBER = "01210571251";
const WHATSAPP_INTERNATIONAL = "201210571251";
const GOOGLE_MAPS_URL = "https://maps.app.goo.gl/iF1ZN3oPdknx53mt9";
const FACEBOOK_PAGE_URL =
  "https://www.facebook.com/p/%D9%83%D9%88%D8%A8%D9%89-%D9%83%D8%A7%D8%AA-100090709554990/";

interface CartItem {
  product: InventoryItem;
  quantity: number;
}

export default function StorefrontPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<InventoryItem[]>(INITIAL_PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [orderSent, setOrderSent] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);

  // Load products from Supabase or localStorage cache
  useEffect(() => {
    async function loadProducts() {
      try {
        const cached = localStorage.getItem("copycat_inventory_v1_2") || localStorage.getItem("copycat_inventory");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length >= INITIAL_PRODUCTS.length) {
            setProducts(parsed);
          } else {
            // Automatically upgrade outdated cache to the full imported catalog
            setProducts(INITIAL_PRODUCTS);
            localStorage.setItem("copycat_inventory_v1_2", JSON.stringify(INITIAL_PRODUCTS));
          }
        }

        if (isSupabaseConfigured) {
          const { data, error } = await supabase
            .from("inventory")
            .select("*")
            .order("id", { ascending: true });

          if (!error && data && data.length > 0) {
            setProducts(data);
            localStorage.setItem("copycat_inventory_v1_2", JSON.stringify(data));
          }
        }
      } catch {
        console.log("Storefront using local product catalog");
      }
    }
    loadProducts();
  }, []);


  // Filter Categories
  const categories = useMemo(() => {
    return ["الكل", ...Array.from(new Set(products.map((p) => p.category)))];
  }, [products]);

  // Filtered Products (Strictly hide incomplete items from customer storefront)
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      // 1. Data completion check: must have name, valid positive price, and category
      const isComplete =
        Boolean(item.name && item.name.trim().length > 0) &&
        Boolean(item.category && item.category.trim().length > 0) &&
        item.price !== undefined &&
        item.price !== null &&
        !isNaN(Number(item.price)) &&
        Number(item.price) > 0;

      if (!isComplete) return false;

      // 2. Search query match
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      // 3. Category match
      const matchCat = selectedCategory === "الكل" || item.category === selectedCategory;

      return matchSearch && matchCat;
    });
  }, [products, searchQuery, selectedCategory]);

  // Cart operations
  const addToCart = (product: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast.success("أضيف للسلة", `تمت إضافة "${product.name}" بنجاح.`);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  // Send WhatsApp Order
  const handleSendWhatsAppOrder = () => {
    if (cart.length === 0) return;

    // Confetti celebration effect!
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}

    let message = `*طلب جديد من مكتبة كوبي كات (Copy Cat)* 📋🐱\n\n`;
    message += `👤 *اسم العميل:* ${customerName.trim() ? customerName.trim() : "طلب مباشر"}\n`;
    if (customerNotes.trim()) {
      message += `📝 *ملاحظات وتفاصيل:* ${customerNotes.trim()}\n`;
    }
    message += `\n*قائمة الأصناف المطلوبة:*\n`;

    cart.forEach((item, index) => {
      const subtotal = item.product.price * item.quantity;
      message += `${index + 1}. ${item.product.name}\n   الكمية: ${item.quantity} × ${item.product.price} ج.م = ${subtotal} ج.م\n`;
    });

    message += `\n-------------------------\n`;
    message += `💰 *الإجمالي النهائي:* ${totalCartPrice} ج.م\n`;
    message += `📍 نرجو تأكيد استلام الطلب وميعاد التجهيز. شكراً!`;

    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${WHATSAPP_INTERNATIONAL}?text=${encoded}`;

    const opened = safeOpenUrl(waUrl);
    if (!opened) {
      window.location.href = waUrl;
    }

    setOrderSent(true);
    toast.success("تم إرسال الطلب", "جاري فتح تطبيق واتساب لتأكيد الطلب مع المكتبة.");
    setTimeout(() => {
      setOrderSent(false);
      setIsCartOpen(false);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 light:bg-slate-50 light:text-slate-900">
      {/* Top Notification Bar */}
      <div className="bg-linear-to-r from-blue-700 via-indigo-700 to-cyan-600 text-white text-xs py-2 px-4 text-center font-bold flex items-center justify-center gap-3 shadow-md">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>خصم خاص وتجهيز فوري لكروت الرقم القومي والشهادات وطباعة الأبحاث!</span>
        </span>
        <a
          href={`https://wa.me/${WHATSAPP_INTERNATIONAL}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-cyan-200 transition font-black"
        >
          اطلب واتساب الآن: {WHATSAPP_NUMBER}
        </a>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 dark:bg-slate-900/90 light:bg-white/90 backdrop-blur-md border-b border-slate-800 dark:border-slate-800 light:border-slate-200 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center p-1 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform border border-slate-700/50">
              <Image
                src="/logo.jpg"
                alt="كوبي كات - Copy Cat"
                width={48}
                height={48}
                priority
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-white dark:text-white light:text-slate-900 text-lg sm:text-xl tracking-tight leading-tight">
                  كوبي كات
                </span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Copy Cat
                </span>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-500 block">
                للطباعة الرقمية والتصوير والحلول المكتبية
              </span>
            </div>
          </Link>

          {/* Quick Contact & Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Direct WhatsApp Call/Chat */}
            <a
              href={`https://wa.me/${WHATSAPP_INTERNATIONAL}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition"
              title="تواصل واتساب مباشرة"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">واتساب: {WHATSAPP_NUMBER}</span>
              <span className="sm:hidden font-bold">واتساب</span>
            </a>

            {/* Cart Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition cursor-pointer"
              title="عرض سلة المشتريات"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">سلة الطلبات</span>
              {totalCartCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] flex items-center justify-center animate-bounce">
                  {totalCartCount}
                </span>
              )}
            </button>

            {/* Theme Toggle Button */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-14 sm:py-20 px-4 sm:px-6 max-w-7xl mx-auto w-full text-center">
        {/* Glow ambient background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-linear-to-tr from-blue-600/20 via-cyan-500/10 to-indigo-600/20 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow" />

        {/* Hero Logo Banner */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6 rounded-3xl overflow-hidden bg-white shadow-2xl shadow-blue-500/20 p-2 border border-slate-700/50 hover:scale-105 transition-transform flex items-center justify-center">
          <Image
            src="/logo.jpg"
            alt="Copy Cat Logo"
            width={112}
            height={112}
            priority
            className="w-full h-full object-contain"
          />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black mb-6">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>المركز الأول لخدمات التصوير والطباعة والمستلزمات المكتبية</span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black leading-tight mb-6 max-w-4xl mx-auto text-white dark:text-white light:text-slate-950">
          كل ما تحتاجه في عالم{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400">
            الطباعة، البطاقات، والمستلزمات المكتبية
          </span>
        </h1>

        <p className="text-slate-400 dark:text-slate-400 light:text-slate-600 text-sm sm:text-lg max-w-3xl mx-auto leading-relaxed mb-10 font-medium">
          نوفر لك كافة احتياجاتك من الأدوات المكتبية والمدرسية والأوراق ومستلزمات الطباعة، اختر الأصناف التي تريدها
          واطلبها مباشرة وسنقوم بتجهيزها لك فوراً عبر الواتساب.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="#catalog"
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-blue-600/30 hover:scale-105 transition-all"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>تصفح المنتجات واطلب بالواتس</span>
          </a>

          <a
            href={`https://wa.me/${WHATSAPP_INTERNATIONAL}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-emerald-600/20 hover:scale-105 transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            <span>واتساب مباشر: {WHATSAPP_NUMBER}</span>
          </a>

          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm sm:text-base border border-slate-700 hover:scale-105 transition-all"
          >
            <MapPin className="w-5 h-5 text-rose-400" />
            <span>موقعنا على خريطة Google</span>
          </a>
        </div>
      </section>

      {/* Catalog & Products Section */}
      <section id="catalog" className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full scroll-mt-24">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-3">
            <Boxes className="w-3.5 h-3.5" /> كتالوج منتجات وخدمات كوبي كات
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white dark:text-white light:text-slate-950">
            اختر ما يناسبك واطلبه فوراً عبر الواتساب
          </h2>
          <p className="text-slate-400 dark:text-slate-400 light:text-slate-600 text-xs sm:text-sm mt-2 max-w-xl mx-auto">
            أسعار واضحة ومحدثة أولاً بأول، اضغط على الصنف لإضافته للسلة وإرسال الطلب مباشرة لرقم المكتبة.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-900/90 dark:bg-slate-900/90 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 rounded-2xl p-4 mb-8 shadow-xl flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            <input
              type="text"
              placeholder="ابحث عن منتج، خامة، أو خدمة..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(24);
              }}
              className="w-full bg-slate-950 dark:bg-slate-950 light:bg-slate-50 border border-slate-800 dark:border-slate-800 light:border-slate-300 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white dark:text-white light:text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Categories Pills */}
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setVisibleCount(24);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "bg-slate-800 dark:bg-slate-800 light:bg-slate-100 text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
          <span>
            يتم عرض {Math.min(visibleCount, filteredProducts.length)} من إجمالي {filteredProducts.length} صنف
          </span>
          {visibleCount < filteredProducts.length && (
            <span className="text-blue-400 font-semibold">استمر في التمرير أو اضغط لعرض المزيد ↓</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.slice(0, visibleCount).map((item) => {
            const inCart = cart.find((c) => c.product.id === item.id);
            return (
              <div
                key={item.id}
                className="group bg-slate-900/80 dark:bg-slate-900/80 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 rounded-3xl p-5 flex flex-col justify-between hover:border-blue-500/60 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {item.category}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>متوفر للتنفيذ</span>
                    </span>
                  </div>

                  <h3 className="font-extrabold text-white dark:text-white light:text-slate-900 text-base mb-2 group-hover:text-blue-400 transition-colors line-clamp-2">
                    {item.name}
                  </h3>

                  {item.notes && (
                    <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600 leading-relaxed mb-4 line-clamp-2">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">السعر</span>
                    <span className="text-lg font-black text-emerald-400 dark:text-emerald-400 light:text-emerald-600">
                      {formatCurrency(item.price)}
                    </span>
                  </div>

                  {inCart ? (
                    <div className="flex items-center gap-1.5 bg-blue-600 text-white p-1 rounded-xl shadow-md">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1 hover:bg-blue-700 rounded-lg transition cursor-pointer"
                        title="إنقاص"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 font-black text-xs">{inCart.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1 hover:bg-blue-700 rounded-lg transition cursor-pointer"
                        title="زيادة"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition cursor-pointer hover:scale-105"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة للطلب</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {visibleCount < filteredProducts.length && (
          <div className="mt-10 text-center flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setVisibleCount((prev) => prev + 24)}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition cursor-pointer hover:scale-105"
            >
              عرض المزيد (+24 صنف)
            </button>
            <button
              onClick={() => setVisibleCount(filteredProducts.length)}
              className="px-5 py-3 rounded-xl bg-slate-800 dark:bg-slate-800 light:bg-slate-200 hover:bg-slate-700 text-slate-300 dark:text-slate-300 light:text-slate-800 text-xs sm:text-sm font-bold transition cursor-pointer"
            >
              عرض كافة الأصناف ({filteredProducts.length})
            </button>
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="py-16 text-center text-slate-500">
            <Boxes className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-bold">لا توجد منتجات أو خدمات مطابقة للبحث حالياً.</p>
          </div>
        )}
      </section>

      {/* Location & Map & Hours Section */}
      <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="relative overflow-hidden bg-linear-to-tr from-slate-900 via-slate-900 to-blue-950 border border-slate-800 rounded-3xl p-6 sm:p-12 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Store Information */}
            <div className="space-y-6 text-right">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
                <MapPin className="w-3.5 h-3.5" /> تفضل بزيارتنا في مقر كوبي كات
              </div>

              <h3 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                الموقع وساعات العمل والتواصل المباشر
              </h3>

              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                يسعدنا استقبالكم يومياً لتصوير وطباعة المستندات الفورية، أو تجهيز كافة طلباتكم وتسليمها
                في أسرع وقت ممكن.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-bold block">موقع المكتبة:</span>
                    <span className="text-sm font-bold text-white">
                      مكتبة كوبي كات (Copy Cat) للادوات المكتبية والطباعة والتصوير
                    </span>
                    <a
                      href={GOOGLE_MAPS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold block mt-0.5 underline"
                    >
                      اضغط هنا لعرض الموقع الدقيق على Google Maps 📍
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-bold block">رقم الواتساب والاتصال:</span>
                    <span className="text-sm font-black text-emerald-400 font-mono dir-ltr inline-block">
                      {WHATSAPP_NUMBER}
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      متاح للرد السريع وتلقي طلبات واستفسارات الطباعة
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-bold block">مواعيد العمل الرسمية:</span>
                    <span className="text-sm font-bold text-slate-200">
                      يومياً من الساعة 9:00 صباحاً حتى 10:00 مساءً
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition hover:scale-105"
                >
                  <MapPin className="w-4 h-4" />
                  <span>فتح الاتجاهات على خرائط جوجل</span>
                </a>

                <a
                  href={`https://wa.me/${WHATSAPP_INTERNATIONAL}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/20 transition hover:scale-105"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>محادثة واتساب فورية</span>
                </a>
              </div>
            </div>

            {/* Visual Location Preview Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 relative shadow-xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-tr from-rose-500 to-amber-500 mx-auto flex items-center justify-center text-white shadow-xl shadow-rose-500/20">
                <MapPin className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-white">خريطة وموقع كوبي كات</h4>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                يمكنك الوصول إلينا بسهولة عبر خرائط جوجل، أو إرسال ملفاتك مباشرة عبر الواتساب وسنقوم
                بتجهيزها واستلامها فور وصولك.
              </p>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">حالة المتجر الآن:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    مفتوح وجاهز لاستقبال الطلبات
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">رقم الهاتف المباشر:</span>
                  <a href={`tel:${WHATSAPP_NUMBER}`} className="font-bold text-blue-400 hover:underline">
                    {WHATSAPP_NUMBER}
                  </a>
                </div>
              </div>

              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-2"
              >
                <span>عرض الموقع على Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Cart Drawer / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  سلة الطلبات ({totalCartCount} أصناف)
                </h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {orderSent ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-black text-white">تم فتح الواتساب بنجاح!</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  تم تجهيز نص طلبك وتوجيهه إلى رقم مكتبة كوبي كات ({WHATSAPP_NUMBER}). اضغط إرسال في
                  الواتساب لتأكيد الطلب.
                </p>
              </div>
            ) : (
              <>
                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 divide-y divide-slate-800/60">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      سلة الطلبات فارغة حالياً. أضف بعض المنتجات أو الخدمات للبدء!
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="pt-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex-1">
                          <h5 className="font-bold text-white text-xs sm:text-sm">
                            {item.product.name}
                          </h5>
                          <span className="text-[11px] text-slate-400">
                            {item.product.price} ج.م × {item.quantity} ={" "}
                            <span className="text-emerald-400 font-bold">
                              {item.product.price * item.quantity} ج.م
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                            <button
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="p-1 text-slate-300 hover:text-white rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-1.5 text-xs font-bold text-white">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="p-1 text-slate-300 hover:text-white rounded"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 rounded hover:bg-red-950/40"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Form Fields for WhatsApp */}
                {cart.length > 0 && (
                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">
                        اسمك أو رقم تليفونك (اختياري لتجهيز الفاتورة):
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="مثال: أحمد محمد"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">
                        ملاحظات أو مواصفات خاصة (اختياري):
                      </label>
                      <input
                        type="text"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="مثال: استلام غداً الساعة 2 ظهراً"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-slate-400 font-bold">الإجمالي المطلوب:</span>
                      <span className="text-xl font-black text-emerald-400">
                        {formatCurrency(totalCartPrice)}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={clearCart}
                        className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold transition cursor-pointer"
                      >
                        إفراغ
                      </button>
                      <button
                        onClick={handleSendWhatsAppOrder}
                        className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>إرسال الطلب عبر واتساب مباشرة ({WHATSAPP_NUMBER})</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating Bottom WhatsApp & Cart Bar for mobile / fast access */}
      {totalCartCount > 0 && !isCartOpen && (
        <div className="fixed bottom-5 right-1/2 translate-x-1/2 z-30 w-[92%] max-w-md bg-blue-600/95 text-white p-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-float border border-blue-400/40">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white font-black text-xs flex items-center justify-center">
              {totalCartCount}
            </span>
            <div>
              <span className="text-xs font-bold block leading-tight">طلبك قيد التجهيز</span>
              <span className="text-sm font-black">{formatCurrency(totalCartPrice)}</span>
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="px-4 py-2 rounded-xl bg-white text-blue-900 font-black text-xs shadow-md hover:bg-blue-50 transition cursor-pointer flex items-center gap-1.5"
          >
            <span>إتمام الطلب بالواتس</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Permanent Floating WhatsApp Quick Contact Button */}
      <a
        href={`https://wa.me/${WHATSAPP_INTERNATIONAL}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm shadow-2xl shadow-emerald-600/50 transition-all hover:scale-105 border border-emerald-400/40 group cursor-pointer"
        title="تواصل معنا فوراً عبر الواتساب"
      >
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold">تواصل واتساب فوري</span>
      </a>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 py-12 px-4 sm:px-6 text-xs text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-right">
          {/* Col 1: Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white flex items-center justify-center p-1 shadow-lg border border-slate-700/50 shrink-0">
                <Image
                  src="/logo.jpg"
                  alt="Copy Cat Logo"
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="font-extrabold text-white text-base block">كوبي كات (Copy Cat)</span>
                <span className="text-[11px] text-slate-400">للطباعة والأدوات المكتبية والمستندات</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              مركز الحلول الرقمية والطباعة الحديثة؛ تصوير وتغليف بطاقات الرقم القومي، استوديو 4×6، وتجهيز
              الأبحاث الأكاديمية والورقيات والأدوات المكتبية والمدرسية الشاملة.
            </p>
          </div>

          {/* Col 2: Services */}
          <div>
            <h4 className="font-bold text-white text-sm mb-3">خدمات ومنتجات كوبي كات</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>• طباعة وتغليف بطاقات وكارنيهات A5 وش وضهر</li>
              <li>• استوديو الصور الشخصية الفورية 4×6 كوداك</li>
              <li>• تفتيح مذكرات ومستندات وتوفير الأحبار</li>
              <li>• إعداد وصياغة الأبحاث الأكاديمية والجامعية</li>
              <li>• بيع وتوريد ورق التصوير والأدوات المكتبية</li>
            </ul>
          </div>

          {/* Col 3: Official Social & Direct WhatsApp */}
          <div>
            <h4 className="font-bold text-white text-sm mb-3">التواصل المباشر والطلبات</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a
                  href={`https://wa.me/${WHATSAPP_INTERNATIONAL}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-bold"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>الواتساب الأساسي: {WHATSAPP_NUMBER} (متاح دائماً)</span>
                </a>
              </li>
              <li>
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-rose-400 hover:text-rose-300 font-semibold"
                >
                  <MapPin className="w-4 h-4" />
                  <span>موقع المكتبة على Google Maps</span>
                </a>
              </li>
              <li>
                <a
                  href={FACEBOOK_PAGE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-semibold"
                >
                  <Share2 className="w-4 h-4" />
                  <span>صفحتنا الرسمية على فيسبوك</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
          <span>
            جميع الحقوق محفوظة © كوبي كات للادوات المكتبية والطباعة والتصوير الرقمية {new Date().getFullYear()}
          </span>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span>سرعة تسليم قياسية</span>
            <span>•</span>
            <span>جودة استوديو أصلية</span>
            <span>•</span>
            <span>أمان وحماية تامة للبيانات</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
