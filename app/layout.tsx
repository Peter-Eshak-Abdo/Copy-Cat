import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/toast-provider";
import { PwaAndErrorGuard } from "@/components/pwa-and-error-guard";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
});

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://copycat-center.vercel.app"),
  title: "كوبي كات | مكتبة كوبي كات | Copy Cat",
  description:
    "مكتبة كوبي كات (Copy Cat) - الوجهة المتكاملة لخدمات الطباعة، تصوير المستندات، استوديو الصور الشخصية 4x6، تجهيز بطاقات الرقم القومي وكارنيهات A5، والأبحاث الجامعية والمستلزمات المكتبية.",
  keywords: [
    "كوبي كات",
    "مكتبة كوبي كات",
    "copy cat",
    "Copy Cat",
    "مكتبة كوبي كات للطباعة والتصوير",
    "Copy-Cat",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
    shortcut: "/logo.jpg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "كوبي كات | Copy Cat",
  },
  openGraph: {
    title: "كوبي كات | مكتبة كوبي كات | Copy Cat",
    description:
      "مكتبة كوبي كات (Copy Cat) - أفضل خدمات تصوير وطباعة وتجهيز مستندات وبطاقات وصور شخصية ومستلزمات مكتبية.",
    url: "https://copycat-center.vercel.app",
    siteName: "مكتبة كوبي كات | Copy Cat",
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "/logo.jpg",
        width: 800,
        height: 800,
        alt: "شعار مكتبة كوبي كات Copy Cat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "كوبي كات | مكتبة كوبي كات | Copy Cat",
    description:
      "مكتبة كوبي كات (Copy Cat) - خدمات تصوير وطباعة متطورة واستوديو صور شخصية ومستلزمات مكتبية.",
    images: ["/logo.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "google-site-verification-copycat",
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
        <PwaAndErrorGuard />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
