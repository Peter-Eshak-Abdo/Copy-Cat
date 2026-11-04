"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useInView,
  useScroll,
  useTransform,
} from "motion/react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  CheckCircle2,
  ShoppingBag,
  MessageCircle,
  X,
  Package,
  Image as ImageIcon,
  MapPin,
  FileText,
  Clock,
  Navigation,
  Compass,
  Layers,
  ExternalLink,
  Phone,
  Printer,
  Camera,
  IdCard,
  BookOpen,
  Sparkles,
  Zap,
  ShieldCheck,
  Wallet,
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  Star,
  Timer,
} from "lucide-react";
import confetti from "canvas-confetti";
import { formatCurrency, openWhatsAppChat } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { INITIAL_PRODUCTS, sanitizeItem, type InventoryItem } from "@/lib/inventory";
import { SITE_CONFIG } from "@/lib/site-config";
import {
  ALL_CATEGORY,
  POPULAR_SEARCHES,
  SORT_OPTIONS,
  categoryMeta,
  normalizeArabic,
  type SortKey,
} from "@/components/storefront/storefront-utils";

const WHATSAPP_NUMBER = SITE_CONFIG.store.phone;
const WHATSAPP_INTERNATIONAL = SITE_CONFIG.store.phoneIntl;
const FACEBOOK_PAGE_URL = SITE_CONFIG.store.facebookUrl;
const DEFAULT_ANNOUNCEMENT =
  "طباعة وتصوير مستندات فوري، استوديو 4×6، وتجهيز أبحاث جامعية ومستلزمات مكتبية";
const PAGE_SIZE = 24;
/** Infinite scroll stops here; after that a button loads more, so the contact sections stay reachable */
const AUTO_LOAD_LIMIT = 72;
const CART_STORAGE_KEY = "copycat_storefront_cart_v1";
const SERVICES_CATEGORY = "خدمات وطباعة";

interface CartItem {
  product: InventoryItem;
  quantity: number;
}

/* ------------------------------------------------------------------ */
/* Store hours (hydration-safe)                                        */
/* ------------------------------------------------------------------ */

function subscribeStoreHours(callback: () => void) {
  const intervalId = window.setInterval(callback, 30000);
  return () => window.clearInterval(intervalId);
}

function getStoreHoursSnapshot(): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return (
    currentMinutes >= SITE_CONFIG.store.openHour * 60 &&
    currentMinutes < SITE_CONFIG.store.closeHour * 60
  );
}

function getStoreHoursServerSnapshot(): boolean {
  return false;
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
    existing.push({ id: Date.now(), ...order });
    localStorage.setItem("copycat_offline_orders", JSON.stringify(existing));
  } catch { }
}

function isListable(item: InventoryItem): boolean {
  return (
    Boolean(item.name?.trim()) &&
    Boolean(item.category?.trim()) &&
    item.price !== undefined &&
    item.price !== null &&
    !isNaN(Number(item.price)) &&
    Number(item.price) > 0
  );
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ------------------------------------------------------------------ */
/* WhatsApp link: a stable href (same on server and client) and a     */
/* click handler that opens the app on phones / WhatsApp Web on PCs.   */
/* ------------------------------------------------------------------ */

function waHref(text?: string) {
  return `https://wa.me/${WHATSAPP_INTERNATIONAL}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

function WaLink({
  text,
  className,
  children,
  title,
}: {
  text?: string;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <a
      href={waHref(text)}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      onClick={(e) => {
        if (openWhatsAppChat(WHATSAPP_INTERNATIONAL, text)) e.preventDefault();
      }}
      className={className}
    >
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Small animated pieces                                               */
/* ------------------------------------------------------------------ */

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to]);
  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString("ar-EG")}
      {suffix}
    </span>
  );
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
}) {
  return (
    <Reveal className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold">
        <Sparkles className="w-3.5 h-3.5" />
        {eyebrow}
      </span>
      <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">{subtitle}</p>
      )}
    </Reveal>
  );
}

const FLOATING_DECOR = [
  { emoji: "✏️", className: "top-[6%] left-[8%] text-3xl", duration: 5.5, delay: 0 },
  { emoji: "📚", className: "bottom-[30%] left-[2%] text-4xl hidden md:block", duration: 6.5, delay: 0.6 },
  { emoji: "📎", className: "top-[10%] left-[46%] text-2xl hidden xl:block", duration: 5, delay: 1.2 },
  { emoji: "✂️", className: "bottom-[22%] left-[46%] text-3xl hidden xl:block", duration: 7, delay: 0.3 },
  { emoji: "🎨", className: "top-[4%] right-[4%] text-2xl hidden lg:block", duration: 6, delay: 0.9 },
]

const SERVICES = [
  {
    icon: Printer,
    title: "طباعة وتصوير فوري",
    text: "ابعت الملف PDF أو Word على الواتساب ونطبعه أبيض وأسود أو ألوان، تستلمه جاهز.",
    cta: "ابعت ملف للطباعة",
    message: "مرحباً مكتبة كوبي كات، أود إرسال ملف للطباعة. (عدد النسخ / ألوان أو أبيض وأسود): ",
    tone: "from-blue-600 to-indigo-600",
  },
  {
    icon: Camera,
    title: "استوديو صور شخصية 4×6",
    text: "صور للمدارس والجامعات والوظائف والباسبور، بخلفية نظيفة وطباعة على ورق صور.",
    cta: "احجز تصوير",
    message: "مرحباً مكتبة كوبي كات، أود عمل صور شخصية 4×6. العدد المطلوب: ",
    tone: "from-fuchsia-600 to-pink-600",
  },
  {
    icon: IdCard,
    title: "تغليف اوراق وشهادات",
    text: "سلوفان حراري يحمي الاوراق والشهادات من الماء والتلف.",
    cta: "اسأل عن التغليف",
    message: "مرحباً مكتبة كوبي كات، أود الاستفسار عن تغليف (ورقة / شهادة). المقاس: ",
    tone: "from-amber-500 to-orange-600",
  },
  {
    icon: BookOpen,
    title: "أبحاث ومذكرات جامعية",
    text: "تجهيز وتنسيق الأبحاث وطباعة المذكرات وتغلفها حسب طلبك.",
    cta: "اطلب بحثك",
    message: "مرحباً مكتبة كوبي كات، أود تجهيز بحث / مذكرة. الموضوع والمادة: ",
    tone: "from-emerald-600 to-teal-600",
  },
];

const ORDER_STEPS = [
  { icon: Search, title: "اختار اللي محتاجه", text: "دوّر بالاسم أو تصفح الأقسام وضيف المنتجات للسلة." },
  { icon: MessageCircle, title: "ابعت الطلب واتساب", text: "بضغطة واحدة الطلب بيتكتب لوحده بالأسعار والإجمالي." },
  { icon: CheckCircle2, title: "استلم طلبك جاهز", text: "بنأكد معاك ونجهزه بـ'تمام جاهز'، تعدي تستلمه من غير انتظار." },
];

const WHY_US = [
  { icon: Zap, title: "سرعة في التنفيذ", text: "الطباعة والصور بتخلص وانت مستني." },
  { icon: Wallet, title: "أسعار واضحة", text: "سعر كل منتج مكتوب قدامك قبل ما تطلب." },
  { icon: ShieldCheck, title: "خامات مضمونة", text: "ورق وأحبار وأدوات بجودة ثابتة." },
  { icon: Timer, title: "الواتساب شغال", text: "ابعت طلبك في أي وقت ونجهزه في اقرب وقت." },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function StorefrontPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<InventoryItem[]>(INITIAL_PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [cartLines, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [orderSent, setOrderSent] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [modalQty, setModalQty] = useState(1);
  const [cartBump, setCartBump] = useState(0);
  const [mapType, setMapType] = useState<"k" | "m">("k");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [announcementText, setAnnouncementText] = useState(DEFAULT_ANNOUNCEMENT);
  const toolbarSearchRef = useRef<HTMLInputElement>(null);

  const isStoreOpen = useSyncExternalStore(
    subscribeStoreHours,
    getStoreHoursSnapshot,
    getStoreHoursServerSnapshot
  );

  /* Banner text from the admin dashboard */
  useEffect(() => {
    fetch("/api/public/banner")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.text === "string" && d.text.trim()) setAnnouncementText(d.text.trim());
      })
      .catch(() => { });
  }, []);

  /* WhatsApp QR for the contact section */
  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(`https://wa.me/${WHATSAPP_INTERNATIONAL}`, {
          margin: 1,
          width: 360,
          color: { dark: "#064e3b", light: "#ffffff" },
        })
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Product catalog: local cache first, then the shared catalog from the server */
  useEffect(() => {
    async function loadProducts() {
      try {
        let customImagesMap: Record<string | number, { image?: string; images?: string[] }> = {};
        try {
          const savedCustom = localStorage.getItem("copycat_custom_images");
          if (savedCustom) customImagesMap = JSON.parse(savedCustom);
        } catch { }

        const mergeWithCustomImages = (list: InventoryItem[]): InventoryItem[] =>
          list.map((it) => {
            const custom = customImagesMap[it.id];
            if (custom && custom.image) {
              return sanitizeItem({ ...it, image: custom.image, images: custom.images || [custom.image] });
            }
            const initMatch = INITIAL_PRODUCTS.find((p) => p.id === it.id || p.name === it.name);
            // A photo saved from the admin (database) wins over the built-in catalog photo
            if (initMatch && !it.image) {
              return sanitizeItem({ ...it, image: initMatch.image, images: initMatch.images });
            }
            return sanitizeItem(it);
          });

        const CURRENT_CACHE_KEY = "copycat_inventory_v8_local_catalog";
        const cached = localStorage.getItem(CURRENT_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          setProducts(
            mergeWithCustomImages(
              Array.isArray(parsed) && parsed.length >= INITIAL_PRODUCTS.length ? parsed : INITIAL_PRODUCTS
            )
          );
        } else {
          setProducts(mergeWithCustomImages(INITIAL_PRODUCTS));
        }

        // Shared catalog from the server (Firestore; no cost / wholesale prices). null = not reachable
        const res = await fetch("/api/public/products");
        const data = res.ok ? ((await res.json()) as { items: InventoryItem[] | null }) : null;
        if (data?.items && data.items.length > 0) {
          const hydrated = mergeWithCustomImages(
            data.items.map((it) => ({
              ...it,
              price: Number(it.price),
              notes: it.notes ?? undefined,
              image: it.image ?? undefined,
              images: Array.isArray(it.images) && it.images.length ? it.images : undefined,
            }))
          );
          setProducts(hydrated);
          localStorage.setItem(CURRENT_CACHE_KEY, JSON.stringify(hydrated));
        }
      } catch {
        console.log("Using fallback products");
      }
    }
    loadProducts();
  }, []);

  /* The cart survives a reload, so a customer who leaves and comes back keeps their order */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore once after hydration (localStorage is client-only)
        setCart(
          saved.filter(
            (c: CartItem) => c && c.product && typeof c.product.id === "number" && c.quantity > 0
          )
        );
      }
    } catch { }
    setCartLoaded(true);
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartLines));
    } catch { }
  }, [cartLines, cartLoaded]);

  /* Cart lines show the latest catalog price / name / photo (the saved copy is only a fallback) */
  const cart = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return cartLines.map((c) => ({ ...c, product: byId.get(c.product.id) ?? c.product }));
  }, [cartLines, products]);

  /* Lock page scroll and close on Escape while a panel is open */
  const anyPanelOpen = isCartOpen || selectedProduct !== null;
  useEffect(() => {
    if (!anyPanelOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCartOpen(false);
        setSelectedProduct(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [anyPanelOpen]);

  /* ---------------------------------------------------------------- */
  /* Derived data                                                      */
  /* ---------------------------------------------------------------- */

  const listable = useMemo(() => products.filter(isListable), [products]);

  const searchIndex = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of listable) {
      map.set(p.id, normalizeArabic(`${p.name} ${p.category} ${p.notes ?? ""}`));
    }
    return map;
  }, [listable]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of listable) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return counts;
  }, [listable]);

  const categories = useMemo(
    () => [
      ALL_CATEGORY,
      ...Array.from(categoryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([c]) => c),
    ],
    [categoryCounts]
  );

  const filteredProducts = useMemo(() => {
    const tokens = normalizeArabic(searchQuery).split(" ").filter(Boolean);
    const result = listable.filter((item) => {
      if (selectedCategory !== ALL_CATEGORY && item.category !== selectedCategory) return false;
      if (tokens.length === 0) return true;
      const hay = searchIndex.get(item.id) ?? "";
      return tokens.every((t) => hay.includes(t));
    });
    if (sortKey === "price-asc") result.sort((a, b) => a.price - b.price);
    else if (sortKey === "price-desc") result.sort((a, b) => b.price - a.price);
    else if (sortKey === "name") result.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    else if (tokens.length > 0) {
      // Name matches first, then category / notes matches
      const nameHit = (p: InventoryItem) => {
        const n = normalizeArabic(p.name);
        return tokens.every((t) => n.includes(t)) ? 0 : 1;
      };
      result.sort((a, b) => nameHit(a) - nameHit(b));
    }
    return result;
  }, [listable, searchIndex, searchQuery, selectedCategory, sortKey]);

  const featuredServices = useMemo(
    () => listable.filter((p) => p.category === SERVICES_CATEGORY).slice(0, 4),
    [listable]
  );

  const relatedProducts = useMemo(() => {
    if (!selectedProduct) return [];
    return listable
      .filter((p) => p.category === selectedProduct.category && p.id !== selectedProduct.id)
      .sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)))
      .slice(0, 4);
  }, [listable, selectedProduct]);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const hasFilters = searchQuery.trim() !== "" || selectedCategory !== ALL_CATEGORY || sortKey !== "default";

  /* Infinite scroll: load the next page when the sentinel nears the screen */
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visibleCount < filteredProducts.length && visibleCount < AUTO_LOAD_LIMIT;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisibleCount((c) => c + PAGE_SIZE);
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, visibleCount]);

  /* ---------------------------------------------------------------- */
  /* Actions                                                           */
  /* ---------------------------------------------------------------- */

  const resetPaging = () => setVisibleCount(PAGE_SIZE);

  const pickCategory = (cat: string, scroll = false) => {
    setSelectedCategory(cat);
    resetPaging();
    if (scroll) scrollToId("catalog");
  };

  const runSearch = (q: string, scroll = true) => {
    setSearchQuery(q);
    resetPaging();
    if (scroll) scrollToId("catalog");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(ALL_CATEGORY);
    setSortKey("default");
    resetPaging();
  };

  const addToCart = useCallback(
    (product: InventoryItem, qty = 1) => {
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + qty } : item
          );
        }
        return [...prev, { product, quantity: qty }];
      });
      // No toast here: on phones it covered the cart's send button. The card turns into a stepper and the cart icon bounces.
      setCartBump((b) => b + 1);
    },
    []
  );

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) =>
    setCart((prev) => prev.filter((item) => item.product.id !== productId));

  const openProduct = (item: InventoryItem) => {
    setSelectedProduct(item);
    setActiveImage(0);
    setModalQty(1);
  };

  function handleSendWhatsAppOrder() {
    if (cart.length === 0) return;
    try {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } });
    } catch { }

    let message = `*طلب جديد من مكتبة كوبي كات (Copy Cat)* 📋🐱\n\n`;
    message += `👤 *اسم العميل:* ${customerName.trim() ? customerName.trim() : "طلب مباشر"}\n`;
    if (customerNotes.trim()) message += `📝 *ملاحظات:* ${customerNotes.trim()}\n`;
    message += `\n*الأصناف المطلوبة:*\n`;
    cart.forEach((item, index) => {
      const subtotal = item.product.price * item.quantity;
      message += `${index + 1}. ${item.product.name} (كمية: ${item.quantity}) = ${subtotal} ج.م\n`;
    });
    message += `\n💰 *الإجمالي:* ${totalCartPrice} ج.م\n`;

    if (!openWhatsAppChat(WHATSAPP_INTERNATIONAL, message)) {
      window.location.assign(waHref(message));
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
      toast.info("تم حفظ الطلب أوفلاين", "أنت غير متصل بالإنترنت حالياً، تم حفظ بيانات طلبك في جهازك.");
    } else {
      toast.success("تم التوجيه للواتساب", "اضغط إرسال في المحادثة لتأكيد الطلب.");
    }

    setOrderSent(true);
    setTimeout(() => {
      setOrderSent(false);
      setIsCartOpen(false);
    }, 3500);
  }

  const productWhatsAppText = (product: InventoryItem, qty = 1) =>
    `مرحباً مكتبة كوبي كات، أود طلب:\n- ${product.name}\n- الكمية: ${qty}\n- السعر: ${product.price} ج.م`;

  /* Hero parallax */
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroImageY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const heroImageRotate = useTransform(scrollYProgress, [0, 1], [-2, 2]);

  const galleryImages = selectedProduct
    ? (Array.from(new Set([selectedProduct.image, ...(selectedProduct.images || [])].filter(Boolean))) as string[])
    : [];

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white overflow-x-clip">
        {/* ============ Announcement marquee ============ */}
        <div className="bg-gradient-to-l from-blue-700 via-blue-600 to-indigo-600 text-white text-xs font-semibold py-2 overflow-hidden">
          <div className="cc-marquee flex w-max gap-10 whitespace-nowrap">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center gap-10" aria-hidden={dup === 1}>
                <span>⚡ {announcementText}</span>
                <span>📲 ابعت ملفاتك على الواتساب {WHATSAPP_NUMBER} واستلمها جاهزة</span>
                <span>🕘 {SITE_CONFIG.store.hoursDisplay}</span>
                <span>📍 شارع الدقهلية - عرايشية مصر - الإسماعيلية</span>
              </div>
            ))}
          </div>
        </div>

        {/* ============ Header ============ */}
        <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 h-16 px-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <motion.div
                whileHover={{ rotate: -8, scale: 1.06 }}
                className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-slate-200 p-1 shadow-sm"
              >
                <Image src="/logo.jpg" alt="Copy Cat" width={40} height={40} priority className="w-full h-full object-contain" />
              </motion.div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-lg text-slate-900 tracking-tight">كوبي كات</span>
                  <OpenBadge open={isStoreOpen} />
                </div>
                <span className="text-[11px] text-slate-500 hidden sm:block">مكتبة ومطبعة • الإسماعيلية</span>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-1 text-sm font-bold text-slate-600">
              {[
                ["services", "خدماتنا"],
                ["categories", "الأقسام"],
                ["catalog", "المنتجات"],
                ["how", "إزاي تطلب"],
                ["contact", "تواصل معنا"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => scrollToId(id)}
                  className="px-3 py-2 rounded-lg hover:bg-slate-100 hover:text-blue-700 transition cursor-pointer"
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => {
                  scrollToId("catalog");
                  setTimeout(() => toolbarSearchRef.current?.focus({ preventScroll: true }), 500);
                }}
                className="lg:hidden w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 cursor-pointer"
                aria-label="بحث"
              >
                <Search className="w-4 h-4" />
              </button>
              <WaLink
                className="flex items-center gap-1.5 px-2.5 sm:px-3 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm shadow-emerald-600/30"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">واتساب {WHATSAPP_NUMBER}</span>
                <span className="hidden sm:inline md:hidden">واتساب</span>
              </WaLink>
              <motion.button
                key={cartBump}
                animate={cartBump ? { scale: [1, 1.18, 0.95, 1] } : undefined}
                transition={{ duration: 0.45 }}
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center gap-1.5 px-2.5 sm:px-3 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
                aria-label="السلة"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">السلة</span>
                {totalCartCount > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center ring-2 ring-white">
                    {totalCartCount}
                  </span>
                )}
              </motion.button>
            </div>
          </div>
        </header>

        {/* ============ Hero ============ */}
        <section ref={heroRef} className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/60 to-slate-50">
          {/* Animated colour blobs */}
          <motion.div
            aria-hidden
            className="absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-blue-400/25 blur-3xl"
            animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute top-40 -left-24 w-[24rem] h-[24rem] rounded-full bg-fuchsia-400/20 blur-3xl"
            animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute bottom-0 right-1/3 w-[20rem] h-[20rem] rounded-full bg-amber-300/25 blur-3xl"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          {FLOATING_DECOR.map((d, i) => (
            <motion.span
              key={i}
              aria-hidden
              className={`absolute select-none pointer-events-none drop-shadow-sm ${d.className}`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 0.9, scale: 1, y: [0, -14, 0], rotate: [0, 8, -6, 0] }}
              transition={{
                opacity: { delay: 0.4 + d.delay, duration: 0.6 },
                scale: { delay: 0.4 + d.delay, duration: 0.6 },
                y: { duration: d.duration, repeat: Infinity, ease: "easeInOut", delay: d.delay },
                rotate: { duration: d.duration * 1.3, repeat: Infinity, ease: "easeInOut", delay: d.delay },
              }}
            >
              {d.emoji}
            </motion.span>
          ))}

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-14 sm:pt-16 sm:pb-20 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* Copy */}
            <div className="text-center lg:text-right">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur border border-slate-200 text-slate-700 text-xs font-bold shadow-sm"
              >
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">{SITE_CONFIG.store.hoursDisplay}</span>
                <span className="sm:hidden">9 ص - 10 م</span>
                <span className="text-slate-300">•</span>
                {isStoreOpen ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <span className="relative flex w-2 h-2">
                      <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-70" />
                      <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
                    </span>
                    مفتوح الآن
                  </span>
                ) : (
                  <span className="text-rose-600">مغلق الآن • يفتح 9 ص</span>
                )}
              </motion.div>

              <motion.h1
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
                className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-slate-900"
              >
                {["كل", "اللي", "تحتاجه"].map((w, i) => (
                  <motion.span
                    key={i}
                    variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="inline-block ml-3"
                  >
                    {w}
                  </motion.span>
                ))}
                <br />
                <motion.span
                  variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block bg-gradient-to-l from-blue-600 via-indigo-600 to-fuchsia-600 bg-clip-text text-transparent cc-gradient-pan pb-2"
                >
                  للمدرسة والشغل
                </motion.span>
                <motion.span
                  variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }}
                  className="inline-block mr-3"
                >
                  في مكان واحد
                </motion.span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.5 }}
                className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0"
              >
                طباعة فورية، صور شخصية 4×6، وأكتر من{" "}
                <span className="font-black text-slate-900">{listable.length} صنف</span> أدوات مكتبية ومدرسية
                بأسعار واضحة. اختار واطلب على الواتساب في ثواني.
              </motion.p>

              {/* Big search */}
              <motion.form
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  runSearch(searchQuery);
                }}
                className="mt-7 max-w-xl mx-auto lg:mx-0"
              >
                <div className="relative flex items-center bg-white rounded-2xl border border-slate-200 shadow-xl shadow-blue-900/5 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition">
                  <Search className="w-5 h-5 text-slate-400 absolute right-4 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      resetPaging();
                    }}
                    placeholder="بتدور على إيه؟ كشكول، ألوان، آلة حاسبة..."
                    className="flex-1 min-w-0 bg-transparent border-0 rounded-2xl pr-12 pl-2 py-4 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 focus:shadow-none"
                    aria-label="ابحث عن منتج"
                  />
                  <button
                    type="submit"
                    className="m-1.5 px-4 sm:px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition cursor-pointer shrink-0"
                  >
                    {searchQuery.trim() ? `اعرض ${filteredProducts.length}` : "بحث"}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-center lg:justify-start gap-1.5">
                  <span className="text-xs text-slate-500 font-bold ml-1">الأكثر بحثاً:</span>
                  {POPULAR_SEARCHES.slice(0, 6).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => runSearch(s)}
                      className="px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700 transition cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.form>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.5 }}
                className="mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-3"
              >
                <WaLink
                  text="مرحباً مكتبة كوبي كات، أود إرسال ملف للطباعة."
                  className="group relative inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black shadow-lg shadow-emerald-600/30 transition overflow-hidden"
                >
                  <span className="absolute inset-0 cc-shine" aria-hidden />
                  <FileText className="w-5 h-5" />
                  <span>ابعت ملف للطباعة واتساب</span>
                </WaLink>
                <button
                  onClick={() => scrollToId("catalog")}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 text-slate-800 text-sm font-bold shadow-sm transition cursor-pointer group"
                >
                  <span>تصفح المنتجات</span>
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                </button>
              </motion.div>
            </div>

            {/* Storefront photo with floating cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto w-full max-w-xl"
            >
              <motion.div
                style={{ y: heroImageY, rotate: heroImageRotate }}
                className="relative aspect-[16/10] rounded-[2rem] overflow-hidden shadow-2xl shadow-blue-900/20 ring-8 ring-white"
              >
                <Image
                  src="/images/storefront-360.jpg"
                  alt="واجهة مكتبة كوبي كات"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 560px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
              </motion.div>

              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-6 -right-2 sm:-right-6 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 flex items-center gap-2.5"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-900">طباعة فورية</div>
                  <div className="text-[11px] text-slate-500">أبيض وأسود وألوان</div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -top-5 -left-2 sm:-left-6 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 flex items-center gap-2.5"
              >
                <div className="w-10 h-10 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-900">صور 4×6</div>
                  <div className="text-[11px] text-slate-500">استلم في نفس اليوم</div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="hidden sm:flex absolute top-1/2 -left-10 bg-emerald-600 text-white rounded-2xl shadow-xl p-3 items-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                <div className="text-xs font-black">اطلب واتساب</div>
              </motion.div>
            </motion.div>
          </div>

          {/* Stats strip */}
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-12">
            <Reveal>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200 shadow-lg shadow-slate-900/5 p-4 sm:p-6">
                {[
                  { value: listable.length, suffix: "+", label: "صنف متاح" },
                  { value: Math.max(categories.length - 1, 1), suffix: "", label: "قسم منظم" },
                  { value: SITE_CONFIG.store.closeHour - SITE_CONFIG.store.openHour, suffix: " ساعة", label: "شغالين يومياً" },
                  { value: 24, suffix: "/7", label: "استقبال طلبات واتساب" },
                ].map((s, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl sm:text-3xl font-black text-blue-700">
                      <CountUp to={s.value} suffix={s.suffix} />
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600 font-semibold mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ Services ============ */}
        <section id="services" className="scroll-mt-20 max-w-7xl mx-auto w-full px-4 sm:px-6 py-14 sm:py-20">
          <SectionHeading
            eyebrow="خدمات المكتبة"
            title={
              <>
                خدمات بتخلص <span className="text-blue-600">وانت مستني</span>
              </>
            }
            subtitle="ابعت طلبك على الواتساب وإحنا نجهزه، ولما توصل تلاقيه مستنيك."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="group relative h-full bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:shadow-slate-900/5 transition-shadow overflow-hidden flex flex-col"
                >
                  <div
                    className={`absolute -top-12 -left-12 w-32 h-32 rounded-full bg-gradient-to-br ${s.tone} opacity-10 group-hover:opacity-20 group-hover:scale-125 transition duration-500`}
                  />
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.tone} text-white flex items-center justify-center shadow-lg group-hover:rotate-6 transition`}
                  >
                    <s.icon className="w-6 h-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">{s.text}</p>
                  <WaLink
                    text={s.message}
                    className="mt-5 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 group-hover:bg-emerald-600 text-white text-xs font-bold transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {s.cta}
                  </WaLink>
                </motion.div>
              </Reveal>
            ))}
          </div>

          {featuredServices.length > 0 && (
            <Reveal delay={0.1} className="mt-6">
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="text-slate-500 font-semibold">أسعار الخدمات:</span>
                {featuredServices.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openProduct(p)}
                    className="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    {p.name.length > 34 ? `${p.name.slice(0, 34)}…` : p.name}
                    <span className="text-emerald-600 mr-1.5">{formatCurrency(p.price)}</span>
                  </button>
                ))}
                <button
                  onClick={() => pickCategory(SERVICES_CATEGORY, true)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  كل الخدمات ←
                </button>
              </div>
            </Reveal>
          )}
        </section>

        {/* ============ Categories ============ */}
        <section id="categories" className="scroll-mt-20 bg-white border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-14 sm:py-20">
            <SectionHeading
              eyebrow="تسوق بالقسم"
              title={
                <>
                  اختار القسم <span className="text-blue-600">ووصل أسرع</span>
                </>
              }
              subtitle="كل منتجات المكتبة مترتبة في أقسام، دوس على القسم وتشوف كل اللي فيه."
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {categories
                .filter((c) => c !== ALL_CATEGORY)
                .map((cat, i) => {
                  const meta = categoryMeta(cat);
                  return (
                    <Reveal key={cat} delay={Math.min(i, 8) * 0.04}>
                      <motion.button
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => pickCategory(cat, true)}
                        className="group relative w-full h-full text-right bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 hover:border-blue-300 p-4 transition-colors cursor-pointer overflow-hidden"
                      >
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${meta.glow} to-transparent opacity-0 group-hover:opacity-100 transition duration-300`}
                        />
                        <div className="relative">
                          <div
                            className={`w-11 h-11 rounded-xl ${meta.tone} flex items-center justify-center group-hover:scale-110 group-hover:-rotate-6 transition`}
                          >
                            <meta.icon className="w-5 h-5" />
                          </div>
                          <div className="mt-3 text-sm font-black text-slate-900 leading-snug">{cat}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{meta.blurb}</div>
                          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700">
                            {categoryCounts.get(cat) ?? 0} صنف
                            <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
                          </div>
                        </div>
                      </motion.button>
                    </Reveal>
                  );
                })}
            </div>
          </div>
        </section>

        {/* ============ Catalog ============ */}
        <main id="catalog" className="scroll-mt-16 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-14 sm:py-20">
          <SectionHeading
            eyebrow="كتالوج المنتجات"
            title={
              <>
                اختار منتجاتك <span className="text-blue-600">واطلبها في ثواني</span>
              </>
            }
          />

          {/* Sticky toolbar */}
          <div className="sticky top-16 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 bg-slate-50/90 backdrop-blur-xl">
            <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-3 shadow-sm space-y-2.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={toolbarSearchRef}
                    type="search"
                    placeholder="ابحث باسم المنتج أو الخامة..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      resetPaging();
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-9 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none transition"
                    aria-label="ابحث عن منتج"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => runSearch("", false)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer"
                      aria-label="مسح البحث"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="relative shrink-0">
                  <ArrowUpDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={sortKey}
                    onChange={(e) => {
                      setSortKey(e.target.value as SortKey);
                      resetPaging();
                    }}
                    className="appearance-none h-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-8 py-2.5 text-xs sm:text-sm font-bold text-slate-700 focus:outline-none cursor-pointer"
                    aria-label="ترتيب المنتجات"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  const meta = categoryMeta(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => pickCategory(cat)}
                      className={`relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${active ? "text-white" : "text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="cat-pill"
                          className="absolute inset-0 rounded-xl bg-blue-600 shadow-sm shadow-blue-600/30"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      )}
                      <meta.icon className="relative w-3.5 h-3.5" />
                      <span className="relative">{cat}</span>
                      <span
                        className={`relative text-[10px] px-1.5 rounded-md ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"
                          }`}
                      >
                        {cat === ALL_CATEGORY ? listable.length : categoryCounts.get(cat) ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Result line */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 px-1 mt-4 mb-4">
            <span>
              {searchQuery.trim() ? (
                <>
                  نتائج <span className="font-black text-slate-900">«{searchQuery.trim()}»</span>:{" "}
                </>
              ) : null}
              <span className="font-black text-slate-900">{filteredProducts.length}</span> صنف
              {selectedCategory !== ALL_CATEGORY && <> في قسم {selectedCategory}</>}
            </span>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs font-bold text-blue-700 hover:underline cursor-pointer">
                مسح الفلاتر
              </button>
            )}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filteredProducts.slice(0, visibleCount).map((item, idx) => (
              <ProductCard
                key={item.id}
                item={item}
                index={idx}
                quantity={cart.find((c) => c.product.id === item.id)?.quantity ?? 0}
                onOpen={() => openProduct(item)}
                onAdd={() => addToCart(item)}
                onChange={(d) => updateQuantity(item.id, d)}
                whatsappText={productWhatsAppText(item)}
              />
            ))}
          </div>

          <div ref={sentinelRef} className="h-1" />
          {visibleCount < filteredProducts.length && (
            <div className="text-center pt-6">
              <button
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="px-6 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold transition cursor-pointer shadow-sm"
              >
                عرض المزيد ({filteredProducts.length - visibleCount} صنف متبقي)
              </button>
            </div>
          )}

          {filteredProducts.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-14 px-4 text-center bg-white rounded-3xl border border-dashed border-slate-300"
            >
              <div className="text-5xl mb-3">🔍</div>
              <p className="text-base font-black text-slate-800">مش لاقيين «{searchQuery.trim() || selectedCategory}» في الكتالوج</p>
              <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
                مش كل حاجة عندنا متصورة على الموقع. اسألنا على الواتساب وهنرد عليك بالتوفر والسعر.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <WaLink
                  text={`مرحباً مكتبة كوبي كات، هل متوفر عندكم: ${searchQuery.trim() || selectedCategory}؟`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  اسأل عنه على الواتساب
                </WaLink>
                <button
                  onClick={clearFilters}
                  className="px-5 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  اعرض كل المنتجات
                </button>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
                {POPULAR_SEARCHES.map((s) => (
                  <button
                    key={s}
                    onClick={() => runSearch(s, false)}
                    className="px-2.5 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </main>

        {/* ============ How to order ============ */}
        <section id="how" className="scroll-mt-20 bg-linear-to-b from-white to-blue-50/50 border-y border-slate-200/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <SectionHeading
              eyebrow="سهلة جداً"
              title={
                <>
                  إزاي تطلب <span className="text-blue-600">في 3 خطوات</span>
                </>
              }
            />
            <div className="relative grid md:grid-cols-3 gap-5">
              <div className="hidden md:block absolute top-10 right-[16%] left-[16%] h-0.5 bg-linear-to-l from-blue-200 via-blue-400 to-emerald-300" />
              {ORDER_STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.12} className="relative text-center">
                  <motion.div
                    whileInView={{ scale: [0.6, 1.1, 1] }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.15, duration: 0.5 }}
                    className="relative mx-auto w-20 h-20 rounded-3xl bg-white border-2 border-blue-100 shadow-lg shadow-blue-900/5 flex items-center justify-center"
                  >
                    <s.icon className="w-8 h-8 text-blue-600" />
                    <span className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-black flex items-center justify-center ring-4 ring-white">
                      {(i + 1).toLocaleString("ar-EG")}
                    </span>
                  </motion.div>
                  <h3 className="mt-4 text-lg font-black text-slate-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 max-w-xs mx-auto leading-relaxed">{s.text}</p>
                </Reveal>
              ))}
            </div>

            <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {WHY_US.map((w, i) => (
                <Reveal key={w.title} delay={i * 0.06}>
                  <div className="h-full bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3 hover:border-blue-300 transition">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                      <w.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">{w.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{w.text}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============ Contact + WhatsApp CTA ============ */}
        <section id="contact" className="scroll-mt-20 max-w-7xl mx-auto w-full px-4 sm:px-6 py-14 sm:py-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-6 sm:p-10 lg:p-12 shadow-2xl shadow-emerald-900/20">
              <motion.div
                aria-hidden
                className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-2xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                aria-hidden
                className="absolute -bottom-24 right-1/3 w-80 h-80 rounded-full bg-teal-300/20 blur-3xl"
                animate={{ x: [0, 30, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative grid lg:grid-cols-[1fr_auto] gap-8 items-center">
                <div className="text-center lg:text-right">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    أسرع طريقة تطلب بيها
                  </span>
                  <h2 className="mt-4 text-3xl sm:text-4xl font-black leading-tight">
                    كلمنا على الواتساب
                    <br />
                    وطلبك يبقى جاهز قبل ما توصل
                  </h2>
                  <p className="mt-3 text-emerald-50/90 text-sm sm:text-base max-w-xl mx-auto lg:mx-0 leading-relaxed">
                    ابعت الملفات، اسأل عن أي منتج أو سعر، أو احجز صورك. بنرد في مواعيد العمل، والرسايل
                    اللي بتوصل بالليل بنجهزها أول ما نفتح.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                    <WaLink
                      text="مرحباً مكتبة كوبي كات 👋"
                      className="relative inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-white text-emerald-800 text-base font-black shadow-xl hover:scale-[1.03] transition overflow-hidden"
                    >
                      <MessageCircle className="w-5 h-5" />
                      ابدأ محادثة واتساب
                    </WaLink>
                    {/*<a
                      href={`tel:${WHATSAPP_NUMBER}`}
                      className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/30 text-white text-base font-bold transition"
                    >
                      <Phone className="w-5 h-5" />
                      <span dir="ltr">{WHATSAPP_NUMBER}</span>
                    </a>*/ }
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-center gap-2 mx-auto">
                  <motion.div
                    whileHover={{ rotate: -3, scale: 1.04 }}
                    className="bg-white rounded-3xl p-3 shadow-2xl"
                  >
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrDataUrl} alt="كود واتساب مكتبة كوبي كات" className="w-40 h-40" />
                    ) : (
                      <div className="w-40 h-40 rounded-xl cc-shimmer" />
                    )}
                  </motion.div>
                  <span className="text-xs text-emerald-50/90 font-semibold">صوّر الكود بكاميرا الموبايل</span>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ============ Map ============ */}
        <section id="location-map" className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-16">
          <Reveal>
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>تعالى زورنا</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">مكان مكتبة كوبي كات</h2>
                  <p className="text-sm text-slate-500 max-w-2xl">{SITE_CONFIG.store.address}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={SITE_CONFIG.store.directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition"
                  >
                    <Navigation className="w-4 h-4 shrink-0" />
                    <span>وصّلني للمكتبة</span>
                  </a>
                  <a
                    href={SITE_CONFIG.store.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Google Maps</span>
                  </a>
                </div>
              </div>

              <div className="relative w-full h-[360px] sm:h-[460px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <iframe
                  title="موقع مكتبة كوبي كات"
                  src={`https://maps.google.com/maps?q=${SITE_CONFIG.store.coordinates.lat},${SITE_CONFIG.store.coordinates.lng}+(%D9%85%D9%83%D8%AA%D8%A8%D8%A9+%D9%83%D9%88%D8%A8%D9%8A+%D9%83%D8%A7%D8%AA+Copy+Cat)&t=${mapType}&z=19&ie=UTF8&iwloc=B&output=embed`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full"
                />
                <div className="absolute top-3 right-3 flex gap-1 bg-white/95 backdrop-blur p-1 rounded-xl shadow-md">
                  {(
                    [
                      ["k", "قمر صناعي", Layers],
                      ["m", "شوارع", Compass],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMapType(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${mapType === key ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  ["🕌", "مسجد المطافي", "على بُعد خطوات في نفس الشارع"],
                  ["🏥", "مركز نور الحياة", "المكتبة أمامه مباشرة"],
                  ["📍", "عرايشية مصر", "شارع الدقهلية - سهل الوصول بالعربية أو مشي"],
                ].map(([emoji, title, text]) => (
                  <div key={title} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                    <span className="text-xl shrink-0">{emoji}</span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{title}</h4>
                      <p className="text-xs text-slate-500">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ============ Footer ============ */}
        <footer className="bg-slate-900 text-slate-300 pt-12 pb-24 sm:pb-10 px-4">
          <div className="max-w-7xl mx-auto grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white p-1">
                  <Image src="/logo.jpg" alt="Copy Cat" width={40} height={40} className="w-full h-full object-contain" />
                </div>
                <span className="font-black text-lg text-white">كوبي كات Copy Cat</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                مطبعة ديجيتال ومكتبة أدوات مكتبية ومدرسية في الإسماعيلية.
              </p>
            </div>
            <div>
              <h4 className="text-white font-black text-sm mb-3">روابط سريعة</h4>
              <ul className="space-y-2 text-sm">
                {[
                  ["services", "الخدمات"],
                  ["categories", "الأقسام"],
                  ["catalog", "المنتجات"],
                  ["how", "إزاي تطلب"],
                ].map(([id, label]) => (
                  <li key={id}>
                    <button onClick={() => scrollToId(id)} className="hover:text-white transition cursor-pointer">
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-black text-sm mb-3">الأقسام</h4>
              <ul className="space-y-2 text-sm">
                {categories
                  .filter((c) => c !== ALL_CATEGORY)
                  .slice(0, 5)
                  .map((c) => (
                    <li key={c}>
                      <button onClick={() => pickCategory(c, true)} className="hover:text-white transition cursor-pointer">
                        {c}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
            <div className="space-y-2.5 text-sm">
              <h4 className="text-white font-black text-sm mb-3">تواصل معنا</h4>
              <WaLink className="flex items-center gap-2 hover:text-emerald-400 transition">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span dir="ltr">{WHATSAPP_NUMBER}</span>
              </WaLink>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>{SITE_CONFIG.store.hoursDisplay}</span>
              </div>
              <a
                href={SITE_CONFIG.store.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 hover:text-white transition"
              >
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>عرايشية مصر، الإسماعيلية</span>
              </a>
              <a
                href={FACEBOOK_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white transition"
              >
                <ExternalLink className="w-4 h-4 text-blue-400" />
                <span>صفحتنا على فيسبوك</span>
              </a>
            </div>
          </div>
          <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-white/10 text-xs text-slate-500 text-center">
            مكتبة كوبي كات Copy Cat • جميع الحقوق محفوظة © {new Date().getFullYear()}
          </div>
        </footer>

        {/* ============ Floating WhatsApp button ============ */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.2, type: "spring", stiffness: 260, damping: 18 }}
          className={`fixed left-4 z-40 transition-[bottom] duration-300 ${totalCartCount > 0 ? "bottom-24 sm:bottom-6" : "bottom-6"
            }`}
        >
          <WaLink
            text="مرحباً مكتبة كوبي كات 👋"
            title="كلمنا واتساب"
            className="group relative flex items-center gap-2 h-14 pl-4 pr-4 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-600/40 transition"
          >
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-30" aria-hidden />
            <MessageCircle className="relative w-6 h-6" />
            <span className="relative hidden sm:inline text-sm font-black max-w-0 group-hover:max-w-40 overflow-hidden whitespace-nowrap transition-all duration-300">
              كلمنا واتساب
            </span>
          </WaLink>
        </motion.div>

        {/* ============ Mobile cart bar ============ */}
        <AnimatePresence>
          {totalCartCount > 0 && !isCartOpen && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="sm:hidden fixed bottom-3 left-3 right-3 z-40 bg-slate-900 text-white p-2.5 pr-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-white/15 font-black text-sm flex items-center justify-center">
                  {totalCartCount}
                </span>
                <div className="leading-tight">
                  <div className="text-[11px] text-slate-400">الإجمالي</div>
                  <div className="text-sm font-black">{formatCurrency(totalCartPrice)}</div>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-black text-sm flex items-center gap-1.5"
              >
                <ShoppingBag className="w-4 h-4" />
                إتمام الطلب
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ Cart drawer ============ */}
        <AnimatePresence>
          {isCartOpen && (
            <motion.div
              className="fixed inset-0 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
                className="absolute top-0 bottom-0 left-0 w-full max-w-md bg-white shadow-2xl flex flex-col"
                role="dialog"
                aria-label="سلة الطلبات"
              >
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">سلة الطلبات</h3>
                      <span className="text-xs text-slate-500">{totalCartCount} قطعة</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="w-9 h-9 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
                    aria-label="إغلاق"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {orderSent ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-10 h-10" />
                    </motion.div>
                    <h4 className="mt-4 text-xl font-black text-slate-900">طلبك اتكتب على الواتساب!</h4>
                    <p className="mt-2 text-sm text-slate-500 max-w-xs">
                      اضغط إرسال في المحادثة، وفريق كوبي كات هيأكد معاك ويبدأ التجهيز.
                    </p>
                  </div>
                ) : cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="text-6xl">🛒</div>
                    <p className="mt-3 text-base font-black text-slate-800">السلة لسه فاضية</p>
                    <p className="mt-1 text-sm text-slate-500">ضيف المنتجات اللي محتاجها وابعت الطلب كله مرة واحدة.</p>
                    <button
                      onClick={() => {
                        setIsCartOpen(false);
                        scrollToId("catalog");
                      }}
                      className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold cursor-pointer"
                    >
                      تصفح المنتجات
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                      <AnimatePresence initial={false}>
                        {cart.map((item) => (
                          <motion.div
                            key={item.product.id}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 40, height: 0, marginTop: 0 }}
                            className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100"
                          >
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-white border border-slate-100 shrink-0 flex items-center justify-center">
                              {item.product.image ? (
                                <Image src={item.product.image} alt="" fill unoptimized sizes="56px" className="object-cover" />
                              ) : (
                                <Package className="w-6 h-6 text-slate-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">{item.product.name}</h5>
                              <div className="text-xs text-emerald-600 font-black mt-1">
                                {formatCurrency(item.product.price * item.quantity)}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5">
                                <button
                                  onClick={() => updateQuantity(item.product.id, 1)}
                                  className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                                  aria-label="زيادة"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <span className="px-1.5 text-xs font-black text-slate-900 tabular-nums">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.product.id, -1)}
                                  className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                                  aria-label="تقليل"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <button
                                onClick={() => removeFromCart(item.product.id)}
                                className="text-[11px] text-rose-500 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                حذف
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    <div className="p-4 border-t border-slate-100 space-y-3 bg-white">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="اسمك (اختياري)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none"
                      />
                      <input
                        type="text"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="ملاحظات (لون، مقاس، معاد الاستلام...)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 font-bold">الإجمالي</span>
                        <motion.span
                          key={totalCartPrice}
                          initial={{ scale: 1.2, color: "#2563eb" }}
                          animate={{ scale: 1, color: "#059669" }}
                          className="text-2xl font-black"
                        >
                          {formatCurrency(totalCartPrice)}
                        </motion.span>
                      </div>
                      <button
                        onClick={handleSendWhatsAppOrder}
                        className="relative w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-base font-black shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer overflow-hidden"
                      >
                        <span className="absolute inset-0 cc-shine" aria-hidden />
                        <Send className="w-5 h-5" />
                        ابعت الطلب على الواتساب
                      </button>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">الطلب بيتأكد معاك على الواتساب قبل التجهيز</span>
                        <button onClick={() => setCart([])} className="text-slate-400 hover:text-rose-600 font-semibold cursor-pointer">
                          إفراغ السلة
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ Product details modal ============ */}
        <AnimatePresence>
          {selectedProduct && (
            <motion.div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
              <motion.div
                initial={{ y: 60, opacity: 0, scale: 0.97 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 60, opacity: 0, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl"
                role="dialog"
                aria-label={selectedProduct.name}
              >
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-3 left-3 z-10 w-9 h-9 rounded-xl text-slate-600 hover:text-slate-900 bg-white/90 backdrop-blur shadow flex items-center justify-center transition cursor-pointer"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="grid sm:grid-cols-2">
                  <div className="p-4 sm:p-5 space-y-2 bg-slate-50 sm:rounded-r-3xl">
                    <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center">
                      <AnimatePresence mode="wait">
                        {galleryImages.length > 0 ? (
                          <motion.div
                            key={activeImage}
                            initial={{ opacity: 0, scale: 1.04 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="absolute inset-0"
                          >
                            <Image
                              src={galleryImages[activeImage] || galleryImages[0]}
                              alt={selectedProduct.name}
                              fill
                              unoptimized
                              sizes="(max-width: 640px) 100vw, 400px"
                              className="object-contain"
                            />
                          </motion.div>
                        ) : (
                          <Package className="w-14 h-14 text-slate-300" />
                        )}
                      </AnimatePresence>
                    </div>
                    {galleryImages.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                        {galleryImages.map((url, idx) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setActiveImage(idx)}
                            className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition cursor-pointer ${activeImage === idx ? "border-blue-600" : "border-transparent opacity-60 hover:opacity-100"
                              }`}
                          >
                            <Image src={url} alt="" fill unoptimized sizes="56px" className="object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col">
                    <button
                      onClick={() => {
                        setSelectedProduct(null);
                        pickCategory(selectedProduct.category, true);
                      }}
                      className={`self-start inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer ${categoryMeta(selectedProduct.category).tone}`}
                    >
                      {selectedProduct.category}
                    </button>
                    <h2 className="mt-2 text-xl font-black text-slate-900 leading-snug">{selectedProduct.name}</h2>
                    <div className="mt-3 text-3xl font-black text-emerald-600">{formatCurrency(selectedProduct.price)}</div>
                    {selectedProduct.stock_count === 0 && (
                      <div className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 self-start">
                        اسأل عن التوفر على الواتساب قبل الطلب
                      </div>
                    )}
                    {selectedProduct.notes && (
                      <p className="mt-4 text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {selectedProduct.notes}
                      </p>
                    )}

                    <div className="mt-5 flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-600">الكمية</span>
                      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                        <button
                          onClick={() => setModalQty((q) => q + 1)}
                          className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center cursor-pointer"
                          aria-label="زيادة"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-black tabular-nums">{modalQty}</span>
                        <button
                          onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                          className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center cursor-pointer"
                          aria-label="تقليل"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                      {modalQty > 1 && (
                        <span className="text-sm text-slate-500">
                          = <span className="font-black text-slate-800">{formatCurrency(selectedProduct.price * modalQty)}</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          addToCart(selectedProduct, modalQty);
                          setSelectedProduct(null);
                        }}
                        className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        أضف للسلة
                      </button>
                      <WaLink
                        text={productWhatsAppText(selectedProduct, modalQty)}
                        className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        <MessageCircle className="w-4 h-4" />
                        اطلب واتساب
                      </WaLink>
                    </div>

                    {relatedProducts.length > 0 && (
                      <div className="mt-6 pt-5 border-t border-slate-100">
                        <h4 className="text-sm font-black text-slate-900 mb-3">ممكن يعجبك كمان</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {relatedProducts.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => openProduct(p)}
                              className="text-right flex items-center gap-2 p-2 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50/40 transition cursor-pointer"
                            >
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-50 shrink-0 flex items-center justify-center">
                                {p.image ? (
                                  <Image src={p.image} alt="" fill unoptimized sizes="40px" className="object-cover" />
                                ) : (
                                  <Package className="w-4 h-4 text-slate-300" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-slate-800 line-clamp-1">{p.name}</div>
                                <div className="text-[11px] font-black text-emerald-600">{formatCurrency(p.price)}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

function OpenBadge({ open }: { open: boolean }) {
  return open ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      مفتوح
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
      مغلق الآن
    </span>
  );
}

function ProductCard({
  item,
  index,
  quantity,
  onOpen,
  onAdd,
  onChange,
  whatsappText,
}: {
  item: InventoryItem;
  index: number;
  quantity: number;
  onOpen: () => void;
  onAdd: () => void;
  onChange: (delta: number) => void;
  whatsappText: string;
}) {
  const meta = categoryMeta(item.category);
  const imageCount = item.images?.length ?? 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, delay: (index % 5) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className={`group relative bg-white rounded-2xl border p-2.5 sm:p-3 flex flex-col shadow-sm hover:shadow-xl hover:shadow-slate-900/5 transition-[border-color,box-shadow] ${quantity > 0 ? "border-blue-400 ring-2 ring-blue-500/10" : "border-slate-200 hover:border-blue-300"
        }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-square bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer"
        aria-label={`تفاصيل ${item.name}`}
      >
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            unoptimized
            priority={index < 5}
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center gap-2 ${meta.tone} bg-opacity-50`}>
            <meta.icon className="w-10 h-10 opacity-60" />
          </div>
        )}
        <span className="absolute inset-x-2 bottom-2 py-1.5 rounded-lg bg-white/90 backdrop-blur text-[11px] font-bold text-slate-800 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition duration-300 hidden sm:block">
          عرض التفاصيل
        </span>
        {imageCount > 1 && (
          <span className="absolute top-2 left-2 text-[10px] font-bold bg-slate-900/75 text-white px-1.5 py-0.5 rounded-md flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            {imageCount}
          </span>
        )}
        {item.category === SERVICES_CATEGORY && (
          <span className="absolute top-2 right-2 text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-md">
            خدمة
          </span>
        )}
      </button>

      <div className="flex-1 flex flex-col pt-2.5">
        <span className="text-[10px] font-bold text-slate-500 line-clamp-1">{item.category}</span>
        <h3
          onClick={onOpen}
          className="mt-0.5 font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 cursor-pointer hover:text-blue-700 transition-colors min-h-[2.5em]"
        >
          {item.name}
        </h3>

        <div className="mt-auto pt-2.5 flex items-center justify-between gap-1.5">
          <span className="text-sm sm:text-base font-black text-emerald-600 whitespace-nowrap">{formatCurrency(item.price)}</span>
          <WaLink
            text={whatsappText}
            title="اطلب على الواتساب"
            className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
          </WaLink>
        </div>

        <div className="mt-2 h-9">
          <AnimatePresence mode="wait" initial={false}>
            {quantity > 0 ? (
              <motion.div
                key="stepper"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="h-full flex items-center justify-between bg-blue-600 text-white rounded-xl px-1"
              >
                <button onClick={() => onChange(1)} className="w-7 h-7 rounded-lg hover:bg-blue-700 flex items-center justify-center cursor-pointer" aria-label="زيادة">
                  <Plus className="w-4 h-4" />
                </button>
                <span className="font-black text-sm tabular-nums">{quantity} في السلة</span>
                <button onClick={() => onChange(-1)} className="w-7 h-7 rounded-lg hover:bg-blue-700 flex items-center justify-center cursor-pointer" aria-label="تقليل">
                  <Minus className="w-4 h-4" />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="add"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                whileTap={{ scale: 0.94 }}
                onClick={onAdd}
                className="w-full h-full rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                أضف للسلة
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
