import { Suspense } from "react";
import type { Metadata } from "next";
import { ProductsBrowser } from "./products-browser";

export const metadata: Metadata = {
  title: "كل المنتجات والأدوات المكتبية",
  description:
    "كل منتجات مكتبة كوبي كات بالإسماعيلية بالأسعار: كشاكيل، أقلام، ألوان، ملفات، أدوات هندسية وخدمات الطباعة. دوّر بالاسم أو بالقسم واطلب على الواتساب.",
  alternates: { canonical: "/products" },
};

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <ProductsBrowser />
    </Suspense>
  );
}
