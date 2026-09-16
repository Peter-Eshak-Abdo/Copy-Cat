"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  CheckCircle2,
  ExternalLink,
  ShoppingBag,
  Boxes,
  MessageCircle,
  X,
  Share2,
  Package,
  Image as ImageIcon,
  WifiOff,
  MapPin,
  FileText,
} from "lucide-react";
import confetti from "canvas-confetti";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { formatCurrency, safeOpenUrl } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { INITIAL_PRODUCTS, sanitizeItem, type InventoryItem } from "@/lib/inventory";
import { SITE_CONFIG } from "@/lib/site-config";

const WHATSAPP_NUMBER = SITE_CONFIG.store.phone;
const WHATSAPP_INTERNATIONAL = SITE_CONFIG.store.phoneIntl;
const GOOGLE_MAPS_URL = "https://maps.app.goo.gl/iF1ZN3oPdknx53mt9";
const FACEBOOK_PAGE_URL = SITE_CONFIG.store.facebookUrl;
const DEFAULT_ANNOUNCEMENT =
  "طباعة وتصوير مستندات فوري، استوديو 4×6، وتجهيز أبحاث جامعية ومستلزمات مكتبية";

interface CartItem {
  product: InventoryItem;
  quantity: number;
}

const emptySubscribe = () => () => {};

function subscribeAnnouncement(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("storage", callback);
  };
}

function getAnnouncementSnapshot(): string {
  try {
    const saved = localStorage.getItem("copycat_announcement_banner");
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch {}
  return DEFAULT_ANNOUNCEMENT;
}

function getAnnouncementServerSnapshot(): string {
  return DEFAULT_ANNOUNCEMENT;
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

function saveOfflineOrder(order: {
  date: string;
  customerName: string;
  customerNotes: string;
  cart: CartItem[];
  totalPrice: number;
  message: string;
}) {
  try {
    const existing = JSON.parse(localStorage.getItem("copycat_offline_orders") || "[]");
    existing.push({
      id: Date.now(),
      ...order,
    });
    localStorage.setItem("copycat_offline_orders", JSON.stringify(existing));
  } catch {}
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

  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );
  const [offlineNoticeModal, setOfflineNoticeModal] = useState(false);

  const [selectedProductModal, setSelectedProductModal] = useState<InventoryItem | null>(null);
  const [activeModalImageIndex, setActiveModalImageIndex] = useState<number>(0);

  const announcementText = useSyncExternalStore(
    subscribeAnnouncement,
    getAnnouncementSnapshot,
    getAnnouncementServerSnapshot
  );

  useEffect(() => {
    async function loadProducts() {
      try {
        let customImagesMap: Record<string | number, { image?: string; images?: string[] }> = {};
        try {
          const savedCustom = localStorage.getItem("copycat_custom_images");
          if (savedCustom) {
            customImagesMap = JSON.parse(savedCustom);
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
        const cached = localStorage.getItem(CURRENT_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length >= INITIAL_PRODUCTS.length) {
            setProducts(mergeWithCustomImages(parsed));
          } else {
            setProducts(mergeWithCustomImages(INITIAL_PRODUCTS));
          }
        } else {
          setProducts(mergeWithCustomImages(INITIAL_PRODUCTS));
        }

        if (isSupabaseConfigured) {
          const { data, error } = await supabase
            .from("inventory")
            .select("*")
            .order("id", { ascending: true });

          if (!error && data && data.length > 0) {
            const hydrated = mergeWithCustomImages(data as InventoryItem[]);
            setProducts(hydrated);
            localStorage.setItem(CURRENT_CACHE_KEY, JSON.stringify(hydrated));
          }
        }
      } catch {
        console.log("Using fallback products");
      }
    }
    loadProducts();
  }, []);

  const categories = useMemo(() => {
    return ["الكل", ...Array.from(new Set(products.map((p) => p.category)))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const isComplete =
        Boolean(item.name && item.name.trim().length > 0) &&
        Boolean(item.category && item.category.trim().length > 0) &&
        item.price !== undefined &&
        item.price !== null &&
        !isNaN(Number(item.price)) &&
        Number(item.price) > 0;

      if (!isComplete) return false;

      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCat = selectedCategory === "الكل" || item.category === selectedCategory;

      return matchSearch && matchCat;
    });
  }, [products, searchQuery, selectedCategory]);

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

  function handleSendWhatsAppOrder() {
    if (cart.length === 0) return;

    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {}

    let message = `*طلب جديد من مكتبة كوبي كات (Copy Cat)* 📋🐱\n\n`;
    message += `👤 *اسم العميل:* ${customerName.trim() ? customerName.trim() : "طلب مباشر"}\n`;
    if (customerNotes.trim()) {
      message += `📝 *ملاحظات:* ${customerNotes.trim()}\n`;
    }
    message += `\n*الأصناف المطلوبة:*\n`;

    cart.forEach((item, index) => {
      const subtotal = item.product.price * item.quantity;
      message += `${index + 1}. ${item.product.name} (كمية: ${item.quantity}) = ${subtotal} ج.م\n`;
    });

    message += `\n💰 *الإجمالي:* ${totalCartPrice} ج.م\n`;

    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${WHATSAPP_INTERNATIONAL}?text=${encoded}`;

    const opened = safeOpenUrl(waUrl);
    if (!opened) {
      window.location.assign(waUrl);
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      saveOfflineOrder({
        date: new Date().toISOString(),
        customerName: customerName.trim() || "طلب مباشر",
        customerNotes: customerNotes.trim(),
        cart,
        totalPrice: totalCartPrice,
        message,
      });
      setOfflineNoticeModal(true);
    } else {
      toast.success("تم التوجيه للواتساب", "جاري فتح المحادثة لتأكيد الطلب.");
    }

    setOrderSent(true);
    setTimeout(() => {
      setOrderSent(false);
      setIsCartOpen(false);
    }, 3500);
  }

  const handleDirectWhatsAppOrder = (product: InventoryItem) => {
    const text = `مرحباً مكتبة كوبي كات، أود طلب:\n- ${product.name}\n- السعر: ${product.price} ج.م`;
    const waUrl = `https://wa.me/${WHATSAPP_INTERNATIONAL}?text=${encodeURIComponent(text)}`;
    const opened = safeOpenUrl(waUrl);
    if (!opened) {
      window.location.assign(waUrl);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Concise Announcement Bar */}
      <div className="bg-blue-600 text-white text-xs font-semibold py-2 px-4 text-center flex items-center justify-center gap-2">
        <span>⚡ {announcementText}</span>
        <span className="hidden sm:inline opacity-70">•</span>
        <a
          href={`https://wa.me/${WHATSAPP_INTERNATIONAL}?text=${encodeURIComponent("مرحباً مكتبة كوبي كات، أود إرسال ملف للطباعة فوراً.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-bold hover:text-blue-100 transition hidden sm:inline"
        >
          أرسل ملفاتك واتساب للاستلام الفوري
        </a>
      </div>

      {/* Main Minimalist Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 py-3 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Identity */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 p-1 flex items-center justify-center shrink-0">
              <Image
                src="/logo.jpg"
                alt="Copy Cat"
                width={40}
                height={40}
                priority
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg text-slate-900 tracking-tight">
                  كوبي كات
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  مفتوح
                </span>
              </div>
              <span className="text-[11px] text-slate-500 hidden sm:block">
                طباعة وتصوير وأدوات مكتبية بالإسماعيلية
              </span>
            </div>
          </Link>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${WHATSAPP_INTERNATIONAL}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">واتساب: {WHATSAPP_NUMBER}</span>
              <span className="sm:hidden">واتساب</span>
            </a>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">السلة</span>
              {totalCartCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-500 text-white font-black text-[10px] flex items-center justify-center">
                  {totalCartCount}
                </span>
              )}
            </button>

            <Link
              href="/admin"
              className="px-2.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition"
              title="لوحة تحكم الأدمن"
            >
              الإدارة
            </Link>
          </div>
        </div>
      </header>

      {/* Ultra-Minimalist Hero & Search Section */}
      <section className="bg-white border-b border-slate-200 py-8 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            مكتبة ومطبعة كوبي كات <span className="text-blue-600">Copy Cat</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
            اطبع مذكراتك وأوراقك فوراً، اطلب مستلزماتك المدرسية والمكتبية، أو استلم صورك الشخصية وبطاقاتك بجودة عالية وسرعة تامة.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <a
              href={`https://wa.me/${WHATSAPP_INTERNATIONAL}?text=${encodeURIComponent("مرحباً مكتبة كوبي كات، أود إرسال ملف للطباعة فوراً.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition"
            >
              <FileText className="w-4 h-4" />
              <span>إرسال ملف للطباعة بالواتساب</span>
            </a>

            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
            >
              <MapPin className="w-4 h-4 text-rose-500" />
              <span>شارع الدقهلية، عرايشية مصر</span>
            </a>
          </div>
        </div>
      </section>

      {/* Catalog & Filter Section */}
      <main id="catalog" className="flex-1 max-w-7xl mx-auto w-full py-8 px-4 sm:px-6 space-y-6">
        {/* Search & Categories Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              placeholder="ابحث عن منتج أو خامة..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(24);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 transition"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setVisibleCount(24);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Count Indicator */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            عرض {Math.min(visibleCount, filteredProducts.length)} من {filteredProducts.length} صنف
          </span>
        </div>

        {/* Clean Minimalist Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredProducts.slice(0, visibleCount).map((item) => {
            const inCart = cart.find((c) => c.product.id === item.id);
            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-200"
              >
                <div>
                  {/* Thumbnail */}
                  <div
                    onClick={() => {
                      setSelectedProductModal(item);
                      setActiveModalImageIndex(0);
                    }}
                    className="cursor-pointer mb-2.5 relative aspect-[16/10] bg-slate-50 rounded-xl overflow-hidden border border-slate-100 flex items-center justify-center group"
                  >
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2 text-center text-slate-400">
                        <Package className="w-8 h-8 opacity-40 mb-1" />
                        <span className="text-[10px] font-bold line-clamp-1">{item.name}</span>
                      </div>
                    )}
                    {item.image && item.images && item.images.length > 1 && (
                      <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-slate-900/80 text-white px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <ImageIcon className="w-2.5 h-2.5" />
                        <span>+{item.images.length}</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 inline-block mb-1.5">
                    {item.category}
                  </span>

                  <h3
                    onClick={() => {
                      setSelectedProductModal(item);
                      setActiveModalImageIndex(0);
                    }}
                    className="font-bold text-slate-900 text-xs sm:text-sm hover:text-blue-600 transition-colors line-clamp-2 cursor-pointer leading-snug"
                  >
                    {item.name}
                  </h3>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-sm sm:text-base font-black text-emerald-600">
                    {formatCurrency(item.price)}
                  </span>

                  {inCart ? (
                    <div className="flex items-center gap-1 bg-blue-600 text-white p-0.5 rounded-lg shadow-xs">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1 hover:bg-blue-700 rounded transition cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-1.5 font-bold text-xs">{inCart.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1 hover:bg-blue-700 rounded transition cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-blue-600 text-white text-[11px] font-bold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>طلب</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {visibleCount < filteredProducts.length && (
          <div className="text-center pt-4">
            <button
              onClick={() => setVisibleCount((prev) => prev + 24)}
              className="px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition cursor-pointer shadow-xs"
            >
              عرض المزيد (+24 صنف)
            </button>
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Boxes className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-bold text-slate-600">لا توجد منتجات مطابقة لبحثك حالياً.</p>
          </div>
        )}
      </main>

      {/* Cart Drawer / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  سلة الطلبات ({totalCartCount} أصناف)
                </h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {orderSent ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">تم تجهيز الطلب بالواتساب!</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  تم فتح الواتساب بنجاح، اضغط إرسال وسيقوم فريق كوبي كات بالتجهيز فوراً.
                </p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-2.5 divide-y divide-slate-100 pr-1">
                  {cart.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">
                      السلة فارغة حالياً. أضف بعض المنتجات للبدء!
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="pt-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 text-right">
                          <h5 className="font-bold text-slate-900 text-xs">
                            {item.product.name}
                          </h5>
                          <span className="text-[11px] text-slate-500">
                            {item.product.price} ج.م × {item.quantity} ={" "}
                            <span className="text-emerald-600 font-bold">
                              {item.product.price * item.quantity} ج.م
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                            <button
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="p-1 text-slate-600 hover:text-slate-900"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-1.5 text-xs font-bold text-slate-900">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="p-1 text-slate-600 hover:text-slate-900"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 rounded hover:bg-red-50"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="اسمك أو رقم هاتفك (اختياري)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="أي ملاحظات خاصة بالتجهيز..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-600 font-bold">الإجمالي:</span>
                      <span className="text-lg font-black text-emerald-600">
                        {formatCurrency(totalCartPrice)}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={clearCart}
                        className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 text-xs font-semibold transition cursor-pointer"
                      >
                        إفراغ
                      </button>
                      <button
                        onClick={handleSendWhatsAppOrder}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>إرسال الطلب بالواتساب</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {selectedProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-xl space-y-4 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedProductModal(null)}
              className="absolute top-4 left-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-900 bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 inline-block mb-1.5">
                {selectedProductModal.category}
              </span>
              <h2 className="text-lg font-black text-slate-900">
                {selectedProductModal.name}
              </h2>
            </div>

            {(() => {
              const galleryImages = [
                selectedProductModal.image,
                ...(selectedProductModal.images || []),
              ].filter(Boolean) as string[];

              return (
                <div className="space-y-2">
                  <div className="relative aspect-[16/10] bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center">
                    {galleryImages.length > 0 ? (
                      <Image
                        src={galleryImages[activeModalImageIndex] || galleryImages[0]}
                        alt={selectedProductModal.name}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, 400px"
                        className="object-contain"
                      />
                    ) : (
                      <Package className="w-10 h-10 opacity-30 text-slate-400" />
                    )}
                  </div>

                  {galleryImages.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {galleryImages.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveModalImageIndex(idx)}
                          className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition cursor-pointer ${
                            activeModalImageIndex === idx
                              ? "border-blue-600"
                              : "border-slate-200 opacity-60"
                          }`}
                        >
                          <Image
                            src={imgUrl}
                            alt=""
                            fill
                            unoptimized
                            sizes="48px"
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {selectedProductModal.notes && (
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                {selectedProductModal.notes}
              </p>
            )}

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">السعر:</span>
                <span className="text-xl font-black text-emerald-600">
                  {formatCurrency(selectedProductModal.price)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDirectWhatsAppOrder(selectedProductModal)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>طلب بالواتساب</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addToCart(selectedProductModal);
                  setSelectedProductModal(null);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>إضافة للسلة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Quick Cart Bar for Mobile */}
      {totalCartCount > 0 && !isCartOpen && (
        <div className="sm:hidden fixed bottom-3 left-3 right-3 z-40 bg-white border border-slate-200 p-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-float">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 font-black text-xs flex items-center justify-center">
              {totalCartCount}
            </span>
            <span className="text-xs font-black text-emerald-600">
              {formatCurrency(totalCartPrice)}
            </span>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs"
          >
            إتمام الطلب 🛒
          </button>
        </div>
      )}

      {/* Ultra-Concise Minimalist Footer (Clean One-Liner / Compact Strip) */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
          <div>
            <span className="font-bold text-slate-800">مكتبة كوبي كات Copy Cat</span>
            <span className="mx-2">•</span>
            <span>جميع الحقوق محفوظة © 2026</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-600">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>عرايشية مصر، الإسماعيلية</span>
            </span>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 font-medium"
            >
              اللوكيشن
            </a>
            <a
              href={`https://wa.me/${WHATSAPP_INTERNATIONAL}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-600 font-medium"
            >
              واتساب
            </a>
            <a
              href={FACEBOOK_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 font-medium"
            >
              فيسبوك
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
