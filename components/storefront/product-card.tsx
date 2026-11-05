"use client";

import { useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Image as ImageIcon, MessageCircle, Minus, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { InventoryItem } from "@/lib/inventory";
import { categoryMeta } from "@/components/storefront/storefront-utils";
import { useStore } from "@/components/storefront/store-provider";
import { Highlight, SERVICES_CATEGORY, WaLink } from "@/components/storefront/ui";

/** One product tile (grid) or row (list). Adding sends its picture flying into the header cart. */
export function ProductCard({
  item,
  index,
  tokens = [],
  view = "grid",
  animateIn = "scroll",
}: {
  item: InventoryItem;
  index: number;
  /** Search words to highlight in the name */
  tokens?: string[];
  view?: "grid" | "list";
  /** "scroll" = appear when scrolled into view; "now" = appear right away (filtered results) */
  animateIn?: "scroll" | "now";
}) {
  const { quantityOf, addToCart, updateQuantity, openProduct, productWhatsAppText } = useStore();
  const quantity = quantityOf(item.id);
  const meta = categoryMeta(item.category);
  const imageCount = item.images?.length ?? 0;
  const imgRef = useRef<HTMLButtonElement>(null);
  const onOpen = () => openProduct(item);
  const onAdd = () => addToCart(item, 1, imgRef.current);

  const enter =
    animateIn === "now"
      ? { initial: { opacity: 0, y: 16, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 } }
      : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-30px" } };

  const stepper = (
    <div className={view === "list" ? "w-36 h-9 shrink-0" : "mt-2 h-9"}>
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
            <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 rounded-lg hover:bg-blue-700 flex items-center justify-center cursor-pointer" aria-label="زيادة">
              <Plus className="w-4 h-4" />
            </button>
            <motion.span key={quantity} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-black text-sm tabular-nums">
              {quantity} في السلة
            </motion.span>
            <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 rounded-lg hover:bg-blue-700 flex items-center justify-center cursor-pointer" aria-label="تقليل">
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
  );

  const picture = (cls: string) => (
    <button
      ref={imgRef}
      type="button"
      onClick={onOpen}
      className={`relative bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer shrink-0 ${cls}`}
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
      {view === "grid" && (
        <span className="absolute inset-x-2 bottom-2 py-1.5 rounded-lg bg-white/90 backdrop-blur text-[11px] font-bold text-slate-800 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition duration-300 hidden sm:block">
          عرض التفاصيل
        </span>
      )}
      {imageCount > 1 && (
        <span className="absolute top-2 left-2 text-[10px] font-bold bg-slate-900/75 text-white px-1.5 py-0.5 rounded-md flex items-center gap-1">
          <ImageIcon className="w-3 h-3" />
          {imageCount}
        </span>
      )}
      {item.category === SERVICES_CATEGORY && (
        <span className="absolute top-2 right-2 text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-md">خدمة</span>
      )}
    </button>
  );

  if (view === "list") {
    return (
      <motion.div
        {...enter}
        transition={{ duration: 0.35, delay: animateIn === "now" ? Math.min(index, 12) * 0.025 : 0 }}
        className={`group bg-white rounded-2xl border p-2.5 flex items-center gap-3 shadow-sm hover:shadow-lg transition-[border-color,box-shadow] ${
          quantity > 0 ? "border-blue-400 ring-2 ring-blue-500/10" : "border-slate-200 hover:border-blue-300"
        }`}
      >
        {picture("w-20 h-20 sm:w-24 sm:h-24")}
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md ${meta.tone}`}>{item.category}</span>
          <h3 onClick={onOpen} className="mt-1 font-bold text-slate-900 text-sm leading-snug line-clamp-2 cursor-pointer hover:text-blue-700">
            <Highlight text={item.name} tokens={tokens} />
          </h3>
          {item.notes && <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{item.notes}</p>}
          <div className="mt-1 text-base font-black text-emerald-600">{formatCurrency(item.price)}</div>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
          <WaLink
            text={productWhatsAppText(item)}
            title="اطلب على الواتساب"
            className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
          </WaLink>
          {stepper}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...enter}
      transition={{ duration: 0.4, delay: animateIn === "now" ? Math.min(index, 15) * 0.03 : (index % 5) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className={`group relative bg-white rounded-2xl border p-2.5 sm:p-3 flex flex-col shadow-sm hover:shadow-xl hover:shadow-slate-900/5 transition-[border-color,box-shadow] ${
        quantity > 0 ? "border-blue-400 ring-2 ring-blue-500/10" : "border-slate-200 hover:border-blue-300"
      }`}
    >
      {picture("aspect-square w-full")}
      <div className="flex-1 flex flex-col pt-2.5">
        <span className="text-[10px] font-bold text-slate-500 line-clamp-1">{item.category}</span>
        <h3
          onClick={onOpen}
          className="mt-0.5 font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 cursor-pointer hover:text-blue-700 transition-colors min-h-[2.5em]"
        >
          <Highlight text={item.name} tokens={tokens} />
        </h3>
        <div className="mt-auto pt-2.5 flex items-center justify-between gap-1.5">
          <span className="text-sm sm:text-base font-black text-emerald-600 whitespace-nowrap">{formatCurrency(item.price)}</span>
          <WaLink
            text={productWhatsAppText(item)}
            title="اطلب على الواتساب"
            className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
          </WaLink>
        </div>
        {stepper}
      </div>
    </motion.div>
  );
}
