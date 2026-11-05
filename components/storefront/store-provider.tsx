"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { CheckCircle2, MessageCircle, Minus, Package, Plus, RotateCcw, Send, ShoppingBag, Trash2, X } from "lucide-react";
import confetti from "canvas-confetti";
import { formatCurrency, openWhatsAppChat } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { INITIAL_PRODUCTS, sanitizeItem, type InventoryItem } from "@/lib/inventory";
import { SITE_CONFIG } from "@/lib/site-config";
import { ALL_CATEGORY, categoryMeta, normalizeArabic } from "@/components/storefront/storefront-utils";
import { WHATSAPP_INTERNATIONAL, WaLink, waHref } from "@/components/storefront/ui";

/**
 * Everything the storefront pages share: the catalog (local cache, then /api/public/products), search,
 * the cart (kept in localStorage), the cart drawer and the product details window. It lives in the
 * (store) layout so the cart and an open product survive moving between the home page and /products.
 */

const CART_STORAGE_KEY = "copycat_storefront_cart_v1";
const CATALOG_CACHE_KEY = "copycat_inventory_v8_local_catalog";
const DEFAULT_ANNOUNCEMENT = "طباعة وتصوير مستندات فوري، استوديو 4×6، وتجهيز أبحاث جامعية ومستلزمات مكتبية";

export interface CartItem {
  product: InventoryItem;
  quantity: number;
}

interface StoreValue {
  /** Products that can be shown (name, category and a price) */
  listable: InventoryItem[];
  categories: string[];
  categoryCounts: Map<string, number>;
  /** Products matching the search words, in "best match first" order (all categories) */
  search: (query: string) => InventoryItem[];
  cart: CartItem[];
  totalCartCount: number;
  totalCartPrice: number;
  quantityOf: (id: number) => number;
  /** `from` = the element the product was added from (its picture flies to the cart) */
  addToCart: (product: InventoryItem, qty?: number, from?: HTMLElement | null) => void;
  updateQuantity: (id: number, delta: number) => void;
  openProduct: (item: InventoryItem) => void;
  openCart: () => void;
  cartBump: number;
  /** The header's cart button registers itself here (target of the flying picture) */
  cartButtonRef: React.RefObject<HTMLButtonElement | null>;
  isStoreOpen: boolean;
  announcementText: string;
  productWhatsAppText: (product: InventoryItem, qty?: number) => string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}

/* Store hours (hydration-safe) */
function subscribeStoreHours(callback: () => void) {
  const id = window.setInterval(callback, 30000);
  return () => window.clearInterval(id);
}
function getStoreHoursSnapshot(): boolean {
  const now = new Date();
  const m = now.getHours() * 60 + now.getMinutes();
  return m >= SITE_CONFIG.store.openHour * 60 && m < SITE_CONFIG.store.closeHour * 60;
}
const getStoreHoursServerSnapshot = () => false;

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

function saveOfflineOrder(order: { date: string; customerName: string; customerNotes: string; cart: CartItem[]; totalPrice: number; message: string }) {
  try {
    const existing = JSON.parse(localStorage.getItem("copycat_offline_orders") || "[]");
    existing.push({ id: Date.now(), ...order });
    localStorage.setItem("copycat_offline_orders", JSON.stringify(existing));
  } catch {}
}

export function searchTokens(query: string): string[] {
  return normalizeArabic(query).split(" ").filter(Boolean);
}

interface Flyer {
  id: number;
  src: string | null;
  from: DOMRect;
  to: DOMRect;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const [products, setProducts] = useState<InventoryItem[]>(INITIAL_PRODUCTS);
  const [cartLines, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [orderSent, setOrderSent] = useState(false);
  // The order just sent, so it can be put back if WhatsApp did not open
  const [lastOrder, setLastOrder] = useState<CartItem[] | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [modalQty, setModalQty] = useState(1);
  const [cartBump, setCartBump] = useState(0);
  const [announcementText, setAnnouncementText] = useState(DEFAULT_ANNOUNCEMENT);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const cartButtonRef = useRef<HTMLButtonElement | null>(null);
  const orderTimer = useRef<number | null>(null);

  const isStoreOpen = useSyncExternalStore(subscribeStoreHours, getStoreHoursSnapshot, getStoreHoursServerSnapshot);

  /* Banner text from the admin dashboard */
  useEffect(() => {
    fetch("/api/public/banner")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.text === "string" && d.text.trim()) setAnnouncementText(d.text.trim());
      })
      .catch(() => {});
  }, []);

  /* Product catalog: local cache first, then the shared catalog from the server */
  useEffect(() => {
    async function loadProducts() {
      try {
        let customImagesMap: Record<string | number, { image?: string; images?: string[] }> = {};
        try {
          const savedCustom = localStorage.getItem("copycat_custom_images");
          if (savedCustom) customImagesMap = JSON.parse(savedCustom);
        } catch {}

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

        const cached = localStorage.getItem(CATALOG_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          setProducts(
            mergeWithCustomImages(Array.isArray(parsed) && parsed.length >= INITIAL_PRODUCTS.length ? parsed : INITIAL_PRODUCTS)
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
          localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(hydrated));
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
        setCart(saved.filter((c: CartItem) => c && c.product && typeof c.product.id === "number" && c.quantity > 0));
      }
    } catch {}
    setCartLoaded(true);
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartLines));
    } catch {}
  }, [cartLines, cartLoaded]);

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

  /* ---------------- derived data ---------------- */

  const listable = useMemo(() => products.filter(isListable), [products]);

  const searchIndex = useMemo(() => {
    const map = new Map<number, { all: string; name: string }>();
    for (const p of listable) {
      map.set(p.id, { all: normalizeArabic(`${p.name} ${p.category} ${p.notes ?? ""}`), name: normalizeArabic(p.name) });
    }
    return map;
  }, [listable]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of listable) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return counts;
  }, [listable]);

  const categories = useMemo(
    () => [ALL_CATEGORY, ...Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c)],
    [categoryCounts]
  );

  const search = useCallback(
    (query: string) => {
      const tokens = searchTokens(query);
      if (tokens.length === 0) return listable;
      const hits = listable.filter((p) => {
        const hay = searchIndex.get(p.id)?.all ?? "";
        return tokens.every((t) => hay.includes(t));
      });
      // Name matches first (and names that start with the word before the rest), then category / notes matches
      const score = (p: InventoryItem) => {
        const n = searchIndex.get(p.id)?.name ?? "";
        if (!tokens.every((t) => n.includes(t))) return 2;
        return n.startsWith(tokens[0]) ? 0 : 1;
      };
      return hits.sort((a, b) => score(a) - score(b));
    },
    [listable, searchIndex]
  );

  /* Cart lines show the latest catalog price / name / photo (the saved copy is only a fallback) */
  const cart = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return cartLines.map((c) => ({ ...c, product: byId.get(c.product.id) ?? c.product }));
  }, [cartLines, products]);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const quantityOf = useCallback((id: number) => cartLines.find((c) => c.product.id === id)?.quantity ?? 0, [cartLines]);

  /* ---------------- actions ---------------- */

  const addToCart = useCallback((product: InventoryItem, qty = 1, from?: HTMLElement | null) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + qty } : item));
      }
      return [...prev, { product, quantity: qty }];
    });
    // No toast here: on phones it covered the cart's send button. The picture flies into the cart instead.
    const target = cartButtonRef.current;
    if (from && target && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const flyer: Flyer = { id: Date.now() + Math.random(), src: product.image ?? null, from: from.getBoundingClientRect(), to: target.getBoundingClientRect() };
      setFlyers((f) => [...f, flyer]);
      window.setTimeout(() => {
        setFlyers((f) => f.filter((x) => x.id !== flyer.id));
        setCartBump((b) => b + 1);
      }, 650);
    } else {
      setCartBump((b) => b + 1);
    }
  }, []);

  const updateQuantity = useCallback((productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const q = item.quantity + delta;
          return q > 0 ? { ...item, quantity: q } : null;
        })
        .filter(Boolean) as CartItem[]
    );
  }, []);

  const removeFromCart = (productId: number) => setCart((prev) => prev.filter((item) => item.product.id !== productId));

  const openProduct = useCallback((item: InventoryItem) => {
    setSelectedProduct(item);
    setActiveImage(0);
    setModalQty(1);
  }, []);

  const openCart = useCallback(() => {
    setOrderSent(false);
    setIsCartOpen(true);
  }, []);

  const productWhatsAppText = useCallback(
    (product: InventoryItem, qty = 1) =>
      `مرحباً مكتبة كوبي كات، أود طلب:\n- ${product.name}\n- الكمية: ${qty}\n- السعر: ${product.price} ج.م`,
    []
  );

  function handleSendWhatsAppOrder() {
    if (cart.length === 0) return;
    try {
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } });
    } catch {}

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

    // The order went to WhatsApp: the cart starts empty again (it can be put back from the success screen)
    setLastOrder(cartLines);
    setCart([]);
    setCustomerNotes("");
    setOrderSent(true);
    if (orderTimer.current !== null) window.clearTimeout(orderTimer.current);
    orderTimer.current = window.setTimeout(() => {
      setOrderSent(false);
      setIsCartOpen(false);
    }, 6000);
  }

  const restoreLastOrder = () => {
    if (!lastOrder) return;
    if (orderTimer.current !== null) window.clearTimeout(orderTimer.current);
    setCart(lastOrder);
    setLastOrder(null);
    setOrderSent(false);
  };

  const galleryImages = selectedProduct
    ? (Array.from(new Set([selectedProduct.image, ...(selectedProduct.images || [])].filter(Boolean))) as string[])
    : [];

  const relatedProducts = useMemo(() => {
    if (!selectedProduct) return [];
    return listable
      .filter((p) => p.category === selectedProduct.category && p.id !== selectedProduct.id)
      .sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)))
      .slice(0, 4);
  }, [listable, selectedProduct]);

  const value: StoreValue = {
    listable,
    categories,
    categoryCounts,
    search,
    cart,
    totalCartCount,
    totalCartPrice,
    quantityOf,
    addToCart,
    updateQuantity,
    openProduct,
    openCart,
    cartBump,
    cartButtonRef,
    isStoreOpen,
    announcementText,
    productWhatsAppText,
  };

  return (
    <StoreContext.Provider value={value}>
      <MotionConfig reducedMotion="user">
        {children}

        {/* ============ Picture flying into the cart ============ */}
        <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
          {flyers.map((f) => {
            const size = Math.min(f.from.width, 80);
            const x0 = f.from.left + f.from.width / 2 - size / 2;
            const y0 = f.from.top + f.from.height / 2 - size / 2;
            const x1 = f.to.left + f.to.width / 2 - size / 2;
            const y1 = f.to.top + f.to.height / 2 - size / 2;
            return (
              <motion.div
                key={f.id}
                initial={{ x: x0, y: y0, scale: 1, opacity: 1, rotate: 0 }}
                animate={{ x: [x0, (x0 + x1) / 2, x1], y: [y0, Math.min(y0, y1) - 120, y1], scale: [1, 0.8, 0.2], opacity: [1, 1, 0.4], rotate: [0, -20, 10] }}
                transition={{ duration: 0.65, ease: "easeInOut" }}
                className="absolute top-0 left-0 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-blue-500/60 bg-white"
                style={{ width: size, height: size }}
              >
                {f.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.src} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center">
                    <ShoppingBag className="w-1/2 h-1/2" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* ============ Floating WhatsApp button ============ */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.2, type: "spring", stiffness: 260, damping: 18 }}
          className={`fixed left-4 z-40 transition-[bottom] duration-300 ${totalCartCount > 0 ? "bottom-24 sm:bottom-6" : "bottom-6"}`}
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
                <span className="w-7 h-7 rounded-lg bg-white/15 font-black text-sm flex items-center justify-center">{totalCartCount}</span>
                <div className="leading-tight">
                  <div className="text-[11px] text-slate-400">الإجمالي</div>
                  <div className="text-sm font-black">{formatCurrency(totalCartPrice)}</div>
                </div>
              </div>
              <button onClick={openCart} className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-black text-sm flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4" />
                إتمام الطلب
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ Cart drawer ============ */}
        <AnimatePresence>
          {isCartOpen && (
            <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                      اضغط إرسال في المحادثة، وفريق كوبي كات هيأكد معاك ويبدأ التجهيز. السلة فضيت عشان طلبك الجاي.
                    </p>
                    {lastOrder && (
                      <button
                        onClick={restoreLastOrder}
                        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        الواتساب مفتحش؟ رجّع الطلب للسلة
                      </button>
                    )}
                  </div>
                ) : cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="text-6xl">🛒</div>
                    <p className="mt-3 text-base font-black text-slate-800">السلة لسه فاضية</p>
                    <p className="mt-1 text-sm text-slate-500">ضيف المنتجات اللي محتاجها وابعت الطلب كله مرة واحدة.</p>
                    <button
                      onClick={() => {
                        setIsCartOpen(false);
                        router.push("/products");
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
                              <div className="text-xs text-emerald-600 font-black mt-1">{formatCurrency(item.product.price * item.quantity)}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5">
                                <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer" aria-label="زيادة">
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <span className="px-1.5 text-xs font-black text-slate-900 tabular-nums">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer" aria-label="تقليل">
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

        {/* ============ Product details window ============ */}
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
                            className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition cursor-pointer ${
                              activeImage === idx ? "border-blue-600" : "border-transparent opacity-60 hover:opacity-100"
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
                        const cat = selectedProduct.category;
                        setSelectedProduct(null);
                        router.push(`/products?cat=${encodeURIComponent(cat)}`);
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
                      <p className="mt-4 text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">{selectedProduct.notes}</p>
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
                        onClick={(e) => {
                          addToCart(selectedProduct, modalQty, e.currentTarget);
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
      </MotionConfig>
    </StoreContext.Provider>
  );
}
