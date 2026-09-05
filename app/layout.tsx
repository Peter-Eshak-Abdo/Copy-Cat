import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "مكتبة كوبي كات | Copy Cat Center",
  description:
    "الوجهة الأولى لخدمات تصوير وطباعة المستندات، تجهيز البطاقات وكارنيهات الـ A5، استوديو الصور الشخصية، الأبحاث الجامعية، وبيع المستلزمات المكتبية والورقية بأعلى جودة وسعر منافس.",
  keywords: [
    "كوبي كات",
    "Copy-Cat",
    "طباعة مستندات",
    "تصوير بطاقات",
    "أبحاث جامعية",
    "صور شخصية 4x6",
    "مستلزمات مكتبية",
  ],
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <body className="font-sans min-h-screen selection:bg-blue-600 selection:text-white antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
