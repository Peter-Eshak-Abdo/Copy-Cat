import type { ReactNode } from "react";
import { StoreProvider } from "@/components/storefront/store-provider";
import { StoreFooter, StoreHeader } from "@/components/storefront/store-chrome";

/**
 * Customer pages (home and /products) share the header, footer, cart and product window, so the cart and
 * an open product stay put when moving between them.
 */
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white overflow-x-clip">
        <StoreHeader />
        <main className="flex-1 flex flex-col">{children}</main>
        <StoreFooter />
      </div>
    </StoreProvider>
  );
}
