"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
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
  Package,
  Image as ImageIcon,
  WifiOff,
} from "lucide-react";
import confetti from "canvas-confetti";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { formatCurrency, safeOpenUrl } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { ThemeToggle } from "@/components/theme-provider";
import { INITIAL_PRODUCTS, sanitizeItem, type InventoryItem } from "@/lib/inventory";
import { SITE_CONFIG } from "@/lib/site-config";

const WHATSAPP_NUMBER = SITE_CONFIG.store.phone;
const WHATSAPP_INTERNATIONAL = SITE_CONFIG.store.phoneIntl;
const GOOGLE_MAPS_URL = "https://maps.app.goo.gl/iF1ZN3oPdknx53mt9";
const FACEBOOK_PAGE_URL = SITE_CONFIG.store.facebookUrl;
const DEFAULT_ANNOUNCEMENT =
  "خصم خاص وتجهيز فوري لكروت الرقم القومي والشهادات وطباعة الأبحاث وسحب المستندات";

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

  // Offline Detection & Mobile Handling
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );
  const [offlineNoticeModal, setOfflineNoticeModal] = useState(false);

  // Product Details Modal State (Point 8 in edits2.0.md)
  const [selectedProductModal, setSelectedProductModal] = useState<InventoryItem | null>(null);
  const [activeModalImageIndex, setActiveModalImageIndex] = useState<number>(0);

  // Dynamic Announcement Banner from Manager Settings
  const announcementText = useSyncExternalStore(
    subscribeAnnouncement,
    getAnnouncementSnapshot,
    getAnnouncementServerSnapshot
  );

  // Load products from Supabase or localStorage cache with custom image support
  useEffect(() => {
    async function loadProducts() {
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

        // 2. Clean customImagesMap of any external 404 links
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
        const cached = localStorage.getItem(CURRENT_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length >= INITIAL_PRODUCTS.length) {
            const sanitizedList = mergeWithCustomImages(parsed);
            setProducts(sanitizedList);
          } else {
            const sanitizedInit = mergeWithCustomImages(INITIAL_PRODUCTS);
            setProducts(sanitizedInit);
            localStorage.setItem(CURRENT_CACHE_KEY, JSON.stringify(sanitizedInit));
          }
        } else {
          const sanitizedInit = mergeWithCustomImages(INITIAL_PRODUCTS);
          setProducts(sanitizedInit);
          localStorage.setItem(CURRENT_CACHE_KEY, JSON.stringify(sanitizedInit));
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
        console.log("Using initial products for storefront");
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

  // Send WhatsApp Order with Offline support & guidance
  function handleSendWhatsAppOrder() {
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
      window.location.assign(waUrl);
    }

    // If customer is offline, persist order in local queue and display modal guidance
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
      toast.info(
        "طلب في وضع Offline",
        "تم حفظ طلبك محلياً وتوجيهه لواتساب. اضغط إرسال داخل واتساب وستصل الرسالة أول ما تفتح نت."
      );
    } else {
      toast.success("تم إرسال الطلب", "جاري فتح تطبيق واتساب لتأكيد الطلب مع المكتبة.");
    }

    setOrderSent(true);
    setTimeout(() => {
      setOrderSent(false);
      setIsCartOpen(false);
    }, 4000);
  };

  // Direct WhatsApp order from product modal
  const handleDirectWhatsAppOrder = (product: InventoryItem) => {
    const text = `مرحباً مكتبة كوبي كات، أود طلب الصنف التالي:\n- ${product.name}\n- السعر: ${product.price} ج.م`;
    const waUrl = `https://wa.me/${WHATSAPP_INTERNATIONAL}?text=${encodeURIComponent(text)}`;
    const opened = safeOpenUrl(waUrl);
    if (!opened) {
      window.location.assign(waUrl);
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const existing = JSON.parse(localStorage.getItem("copycat_offline_orders") || "[]");
        existing.push({
          id: Date.now(),
          date: new Date().toISOString(),
          customerName: "طلب فوري",
          cart: [{ product, quantity: 1 }],
          totalPrice: product.price,
          message: text,
        });
        localStorage.setItem("copycat_offline_orders", JSON.stringify(existing));
      } catch {}
      setOfflineNoticeModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 light:bg-slate-50 light:text-slate-900">
      {/* Top Friendly Announcement Banner */}
      <div className="bg-emerald-600 text-white text-xs sm:text-sm font-bold py-2 px-4 text-center flex items-center justify-center gap-2 shadow-xs">
        <span>⚡ عندك ورق أو ملازم عايز تطبعها دلوقتي؟ ابعتها واتساب وهنجهزهالك فوراً تستلمها بدون انتظار!</span>
        <a
          href={`https://wa.me/${WHATSAPP_INTERNATIONAL}?text=${encodeURIComponent("مرحباً مكتبة كوبي كات، أود إرسال ملف للطباعة فوراً.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-black hover:text-emerald-200 transition"
        >
          اضغط هنا للإرسال
        </a>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 dark:bg-slate-950/90 light:bg-white/95 backdrop-blur-md border-b border-slate-800 dark:border-slate-800 light:border-slate-200 py-3 px-4 sm:px-6 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Logo & Identity */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl overflow-hidden bg-white shadow-md shadow-blue-500/10 p-1 border border-slate-700/40 dark:border-slate-700/40 light:border-slate-200 group-hover:scale-105 transition-transform shrink-0 flex items-center justify-center">
              <Image
                src="/logo.jpg"
                alt="Copy Cat Logo"
                width={44}
                height={44}
                priority
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base sm:text-xl text-white dark:text-white light:text-slate-950 tracking-tight group-hover:text-blue-400 dark:group-hover:text-blue-400 light:group-hover:text-blue-600 transition-colors">
                  كوبي كات
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                  مفتوح الآن
                </span>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-400 light:text-slate-500 hidden sm:block">
                مكتبة ومطبعة متكاملة بالإسماعيلية - تصوير وأدوات
              </span>
            </div>
          </Link>

          {/* Quick Contact & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Direct WhatsApp Call/Chat */}
            <a
              href={`https://wa.me/${WHATSAPP_INTERNATIONAL}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shrink-0 shadow-md shadow-emerald-600/20"
              title="تواصل واتساب مباشرة"
            >
              <MessageCircle className="w-4 h-4 text-white shrink-0" />
              <span className="hidden md:inline">واتساب: {WHATSAPP_NUMBER}</span>
              <span className="md:hidden font-bold">واتساب</span>
            </a>

            {/* Cart Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition cursor-pointer shrink-0"
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

            {/* Theme Toggle Button - High Contrast with Label for Seniors */}
            <ThemeToggle showLabel />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-8 sm:py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full text-center">
        {/* Glow ambient background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-linear-to-tr from-blue-600/10 via-cyan-500/10 to-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Hero Logo Banner */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 rounded-3xl overflow-hidden bg-white shadow-xl shadow-blue-500/10 p-2 border border-slate-700/50 flex items-center justify-center">
          <Image
            src="/logo.jpg"
            alt="Copy Cat Logo"
            width={96}
            height={96}
            priority
            className="w-full h-full object-contain"
          />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-4">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>خدمات الطباعة والتصوير السريع والأدوات المدرسية والمكتبية</span>
        </div>

        <h1 className="text-2xl sm:text-5xl font-black leading-tight mb-3 max-w-4xl mx-auto text-white dark:text-white light:text-slate-950">
          مكتبة ومطبعة{" "}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 via-cyan-400 to-emerald-400">
            كوبي كات Copy Cat
          </span>
        </h1>

        <p className="text-slate-400 dark:text-slate-400 light:text-slate-600 text-xs sm:text-lg max-w-3xl mx-auto leading-relaxed mb-6 sm:mb-10 font-medium">
          نوفر لك كافة احتياجاتك من الأدوات المكتبية والمدرسية والأوراق ومستلزمات الطباعة، اختر الأصناف التي تريدها
          واطلبها مباشرة وسنقوم بتجهيزها لك فوراً عبر الواتساب.
        </p>

        {/* Action Buttons - Full width on small mobile, auto on larger screens */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-4 w-full max-w-md sm:max-w-none mx-auto">
          <a
            href="#catalog"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-base shadow-xl shadow-blue-600/30 hover:scale-105 transition-all"
          >
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>تصفح المنتجات واطلب بالواتس</span>
          </a>

          <a
            href={`https://wa.me/${WHATSAPP_INTERNATIONAL}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-base shadow-xl shadow-emerald-600/20 hover:scale-105 transition-all"
          >
            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>واتساب مباشر: {WHATSAPP_NUMBER}</span>
          </a>

          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-base border border-slate-700 hover:scale-105 transition-all"
          >
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
            <span>موقعنا على خريطة Google</span>
          </a>
        </div>

        {/* Ultra-Simple Quick Steps for Egyptian Print Shop Customers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 text-right">
          <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-500/60 transition shadow-lg flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                📄
              </div>
              <h3 className="text-base font-black text-white">عايز تطبع ورق أو ملفات فوراً؟</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                ابعت الملف (PDF أو وورد أو صور) على الواتساب مع كتابة عدد النسخ وألوان ولا أسود، وهنجهزهولك تستلمه فوراً
                بدون انتظار!
              </p>
            </div>
            <a
              href={`https://wa.me/${WHATSAPP_INTERNATIONAL}?text=${encodeURIComponent("مرحباً مكتبة كوبي كات، أود إرسال ملف للطباعة فوراً.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs text-center flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span>إرسال الملف عبر واتساب</span>
            </a>
          </div>

          <div className="p-5 rounded-2xl bg-blue-950/30 border border-blue-500/30 hover:border-blue-500/60 transition shadow-lg flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg">
                🎒
              </div>
              <h3 className="text-base font-black text-white">عايز كشاكيل أو أقلام ومستلزمات؟</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                انزل تحت واختار اللي محتاجه من الكتالوج واضغط &quot;أضف للسلة&quot;، واضغط إرسال الطلب وهيتبعت جاهز على
                الواتساب بالأسعار والإجمالي.
              </p>
            </div>
            <a
              href="#catalog"
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs text-center flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>تصفح الكتالوج والأسعار</span>
            </a>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition shadow-lg flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-lg">
                📍
              </div>
              <h3 className="text-base font-black text-white">مكان المكتبة ومواعيد العمل</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                مكتبة كوبي كات بالإسماعيلية - بنستقبلكم يومياً من الساعة 8 صباحاً حتى 11 مساءً لخدمات الطباعة، السحب،
                والتجليد الفوري.
              </p>
            </div>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs text-center flex items-center justify-center gap-2 transition"
            >
              <MapPin className="w-4 h-4 text-rose-400" />
              <span>فتح اللوكيشن على الخريطة</span>
            </a>
          </div>
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

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {filteredProducts.slice(0, visibleCount).map((item) => {
            const inCart = cart.find((c) => c.product.id === item.id);
            return (
              <div
                key={item.id}
                className="group bg-slate-900/80 dark:bg-slate-900/80 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 rounded-2xl sm:rounded-3xl p-3 sm:p-5 flex flex-col justify-between hover:border-blue-500/60 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 relative overflow-hidden"
              >
                <div>
                  {/* Main Product Image Thumbnail (Point 8 in edits2.0.md) */}
                  <div
                    onClick={() => {
                      setSelectedProductModal(item);
                      setActiveModalImageIndex(0);
                    }}
                    className="cursor-pointer mb-3 relative aspect-[16/10] bg-slate-950/60 dark:bg-slate-950/60 light:bg-slate-100 rounded-2xl overflow-hidden border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 flex items-center justify-center group/img"
                  >
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover group-hover/img:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-radial from-slate-800/80 via-slate-900 to-slate-950 p-4 text-center select-none group-hover/img:scale-105 transition-transform duration-300">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 p-1.5 border border-white/10 flex items-center justify-center shadow-lg shadow-black/40 mb-2 relative overflow-hidden backdrop-blur-xs">
                          <Image
                            src="/logo.jpg"
                            alt="كوبي كات"
                            fill
                            sizes="48px"
                            className="object-contain p-1"
                          />
                        </div>
                        <span className="text-[11px] font-black text-slate-300 line-clamp-1 max-w-[150px]">
                          {item.name}
                        </span>
                        <span className="text-[9px] font-bold text-blue-400 mt-0.5">
                          {item.category}
                        </span>
                      </div>
                    )}
                    {item.image && item.images && item.images.length > 1 && (
                      <span className="absolute bottom-2 left-2 text-[10px] font-bold bg-black/70 text-white px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        <span>+{item.images.length} صور</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 sm:gap-2 mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[11px] font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 truncate max-w-[100px] sm:max-w-none">
                      {item.category}
                    </span>
                    <span className="hidden sm:flex text-[11px] font-semibold text-emerald-400 items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>متوفر</span>
                    </span>
                  </div>

                  <h3
                    onClick={() => {
                      setSelectedProductModal(item);
                      setActiveModalImageIndex(0);
                    }}
                    className="font-bold sm:font-extrabold text-white dark:text-white light:text-slate-950 text-xs sm:text-base mb-1.5 sm:mb-2 group-hover:text-blue-400 transition-colors line-clamp-2 cursor-pointer leading-snug"
                  >
                    {item.name}
                  </h3>

                  {item.notes && (
                    <p className="text-xs text-slate-400 dark:text-slate-400 light:text-slate-600 leading-relaxed mb-4 line-clamp-2">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="pt-2 sm:pt-4 border-t border-slate-800/80 dark:border-slate-800/80 light:border-slate-200 flex items-center justify-between gap-1.5 sm:gap-2">
                  <div>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold block">السعر</span>
                    <span className="text-sm sm:text-lg font-black text-emerald-400 dark:text-emerald-400 light:text-emerald-600">
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
                      className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] sm:text-xs font-bold shadow-md shadow-blue-600/30 transition cursor-pointer hover:scale-105"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">إضافة للطلب</span>
                      <span className="sm:hidden">أضف</span>
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

      {/* Floating Cart Drawer / Modal - Responsive for compact and modern phones */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 max-w-lg w-full shadow-2xl space-y-3.5 sm:space-y-4 max-h-[92vh] flex flex-col">
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
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Offline Notification Banner inside Cart */}
            {mounted && !isOnline && (
              <div className="bg-amber-500/15 border border-amber-500/40 text-amber-300 p-3 rounded-2xl text-xs font-bold flex items-start gap-2.5">
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-0.5 text-right">
                  <span className="block font-black text-amber-200">أنت في وضع عدم الاتصال (Offline) 📴</span>
                  <span className="text-[11px] text-amber-300/90 leading-relaxed block">
                    يمكنك إتمام الطلب الآن وسيتم تجهيز نص الرسالة في واتساب؛ اضغط إرسال وستصل للمكتبة فور عودة الإنترنت لهاتفك.
                  </span>
                </div>
              </div>
            )}

            {orderSent ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-black text-white">تم فتح الواتساب بنجاح!</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {mounted && !isOnline
                    ? "تم فتح محادثة واتساب ووضع طلبك؛ اضغط إرسال وستصل الرسالة للمكتبة أول ما تفتح إنترنت."
                    : `تم تجهيز نص طلبك وتوجيهه إلى رقم مكتبة كوبي كات (${WHATSAPP_NUMBER}). اضغط إرسال في الواتساب لتأكيد الطلب.`}
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
                        <div className="flex-1 text-right">
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
                        className="py-3 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold transition cursor-pointer"
                      >
                        إفراغ
                      </button>
                      <button
                        onClick={handleSendWhatsAppOrder}
                        className="flex-1 py-3 px-3 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
                      >
                        <Send className="w-4 h-4 shrink-0" />
                        <span>إرسال الطلب بالواتس {mounted && !isOnline ? "(ستصل فور توفر نت)" : `(${WHATSAPP_NUMBER})`}</span>
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
      {mounted && totalCartCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 sm:bottom-5 right-1/2 translate-x-1/2 z-30 w-[94%] max-w-md bg-blue-600/95 text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-float border border-blue-400/40">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white font-black text-xs flex items-center justify-center">
              {totalCartCount}
            </span>
            <div>
              <span className="text-[11px] sm:text-xs font-bold block leading-tight">طلبك قيد التجهيز</span>
              <span className="text-xs sm:text-sm font-black">{formatCurrency(totalCartPrice)}</span>
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-white text-blue-900 font-black text-xs shadow-md hover:bg-blue-50 transition cursor-pointer flex items-center gap-1.5"
          >
            <span>إتمام الطلب {mounted && !isOnline ? "أوفلاين" : "بالواتس"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Permanent Floating WhatsApp Quick Contact Button (Hidden on mobile) */}
      <a
        href={`https://wa.me/${WHATSAPP_INTERNATIONAL}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden md:flex fixed bottom-6 left-6 z-40 items-center gap-2.5 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm shadow-2xl shadow-emerald-600/50 transition-all hover:scale-105 border border-emerald-400/40 group cursor-pointer"
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
              <li className="flex items-start gap-2 text-slate-300 font-medium pt-2 border-t border-slate-800/80">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  شارع الدقهلية بالقرب من مسجد المطافي أمام مركز نور الحياة - عرايشية مصر - الإسماعيلية
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
          <span>
            جميع الحقوق محفوظة © كوبي كات للادوات المكتبية والطباعة والتصوير 2026
          </span>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <ThemeToggle showLabel />
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">جودة استوديو أصلية وتسليم فوري</span>
          </div>
        </div>
      </footer>

      {/* Interactive Product Details & Gallery Modal (Point 8 in edits2.0.md) */}
      {selectedProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-slate-900 dark:bg-slate-900 light:bg-white border border-slate-800 dark:border-slate-800 light:border-slate-200 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setSelectedProductModal(null)}
              className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-white dark:hover:text-white light:hover:text-slate-900 bg-slate-800/60 dark:bg-slate-800/60 light:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header info */}
            <div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-block mb-2">
                {selectedProductModal.category}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white dark:text-white light:text-slate-950">
                {selectedProductModal.name}
              </h2>
            </div>

            {/* Image Gallery */}
            {(() => {
              const galleryImages = [
                selectedProductModal.image,
                ...(selectedProductModal.images || []),
              ].filter(Boolean) as string[];

              return (
                <div className="space-y-3">
                  {/* Large Active Preview */}
                  <div className="relative aspect-[16/10] bg-slate-950 dark:bg-slate-950 light:bg-slate-100 rounded-2xl overflow-hidden border border-slate-800 dark:border-slate-800 light:border-slate-200 flex items-center justify-center">
                    {galleryImages.length > 0 ? (
                      <Image
                        src={galleryImages[activeModalImageIndex] || galleryImages[0]}
                        alt={selectedProductModal.name}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, 600px"
                        className="object-contain"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.src =
                            "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80";
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                        <Package className="w-12 h-12 opacity-30" />
                        <span className="text-xs">لا تتوفر صور إضافية لهذا الصنف</span>
                      </div>
                    )}
                  </div>

                  {/* Thumbnails strip if multiple images */}
                  {galleryImages.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {galleryImages.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveModalImageIndex(idx)}
                          className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition cursor-pointer ${
                            activeModalImageIndex === idx
                              ? "border-blue-500 scale-105 shadow-md shadow-blue-500/20"
                              : "border-slate-800 dark:border-slate-800 light:border-slate-200 opacity-60 hover:opacity-100"
                          }`}
                        >
                          <Image
                            src={imgUrl}
                            alt={`Thumbnail ${idx + 1}`}
                            fill
                            unoptimized
                            sizes="64px"
                            className="object-cover"
                            onError={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              target.src =
                                "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80";
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Description / Notes */}
            {selectedProductModal.notes && (
              <div className="p-4 rounded-2xl bg-slate-950/80 dark:bg-slate-950/80 light:bg-slate-50 border border-slate-800/80 dark:border-slate-800/80 light:border-slate-200">
                <span className="text-xs font-bold text-slate-400 block mb-1">المواصفات والتفاصيل:</span>
                <p className="text-xs sm:text-sm text-slate-200 dark:text-slate-200 light:text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedProductModal.notes}
                </p>
              </div>
            )}

            {/* Pricing & Wholesale Section */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 dark:bg-slate-950/50 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-200">
              <div>
                <span className="text-[11px] text-slate-400 block font-bold">سعر القطعة:</span>
                <span className="text-2xl font-black text-emerald-400 dark:text-emerald-400 light:text-emerald-600">
                  {formatCurrency(selectedProductModal.price)}
                </span>
              </div>

              {selectedProductModal.wholesale_price && selectedProductModal.wholesale_price > 0 && (
                <div className="text-left">
                  <span className="text-[11px] text-slate-400 block font-bold">
                    سعر الجملة (بدءاً من {selectedProductModal.wholesale_min_qty || 10} قطع):
                  </span>
                  <span className="text-lg font-black text-blue-400 dark:text-blue-400 light:text-blue-600">
                    {formatCurrency(selectedProductModal.wholesale_price)}
                  </span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleDirectWhatsAppOrder(selectedProductModal)}
                className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>طلب فوري عبر الواتساب {mounted && !isOnline && "(ستصل فور توفر نت)"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addToCart(selectedProductModal);
                  setSelectedProductModal(null);
                }}
                className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>إضافة إلى سلة الطلبات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline WhatsApp Order Guidance Modal */}
      {mounted && offlineNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4 relative">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <WifiOff className="w-8 h-8 animate-pulse" />
            </div>

            <h3 className="text-xl font-black text-white">
              تم تجهيز طلبك في واتساب (وضع Offline) 📴
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-right">
              تم فتح تطبيق واتساب ووضع تفاصيل وأسعار طلبك كاملة في الرسالة.
              <br />
              <strong className="text-amber-400 block mt-2 text-sm">
                👈 اضغط زر الإرسال (Send) داخل واتساب الآن، وستصل الرسالة للمكتبة تلقائياً بمجرد تشغيل باقة النت أو الواي فاي على هاتفك!
              </strong>
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setOfflineNoticeModal(false)}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating WhatsApp Action Button */}
      <a
        href={`https://wa.me/${WHATSAPP_INTERNATIONAL}?text=${encodeURIComponent("مرحباً مكتبة كوبي كات، أود الاستفسار أو إرسال ملف للطباعة فوراً.")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-2xl shadow-emerald-600/50 hover:scale-105 active:scale-95 transition-all group"
        title="تواصل واتساب فوراً"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
        <MessageCircle className="w-5 h-5 text-white shrink-0" />
        <span className="hidden sm:inline">ابعت ورقك واتساب</span>
      </a>

      {/* Sticky Mobile Cart Bar - Appears when cart has items */}
      {totalCartCount > 0 && !isCartOpen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-blue-500/40 p-3 shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe">
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                <span>سلة طلباتك:</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-black">
                  {totalCartCount} صنف
                </span>
              </span>
              <span className="text-base font-black text-emerald-400">
                {formatCurrency(totalCartPrice)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 active:scale-95 transition cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>مراجعة السلة وإتمام الطلب 🛒</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
