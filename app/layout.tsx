import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "أوفيس برنت ستوديو | Office Print Studio ERP",
  description: "نظام شامل وسحابي لخدمات مراكز الطباعة، المستندات، الصور الشخصية وحصر المخزون",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="bg-slate-950 text-slate-100 font-sans min-h-screen selection:bg-blue-600 selection:text-white antialiased">
        {children}
      </body>
    </html>
  );
}
