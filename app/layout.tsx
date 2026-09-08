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

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://copy-cat-kappa.vercel.app";
};

const baseUrl = getBaseUrl().replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "مكتبة كوبي كات للطباعة والتصوير والادوات المكتبية | Copy Cat Print",
    template: "%s | مكتبة كوبي كات Copy Cat",
  },
  description:
    "مكتبة ومركز كوبي كات (Copy Cat) - المركز الرائد لخدمات تصوير المستندات والكتب، استوديو الصور الشخصية 4x6 كوداك، تجهيز وقص بطاقات الرقم القومي A5، الأبحاث الجامعية والمستلزمات المدرسية والمكتبية.",
  keywords: [
    "كوبي كات",
    "مكتبة كوبي كات",
    "copy cat",
    "Copy Cat",
    "مكتبة كوبي كات للطباعة والتصوير",
    "Copy-Cat",
    "مركز كوبي كات للحلول ",
    "تصوير مستندات",
    "استوديو 4x6",
    "بطاقات الرقم القومي",
    "تغليف وسلوفان A5",
    "مستلزمات مكتبية",
    "خدمات طلابية",
    "أبحاث جامعية",
  ],
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "مكتبة كوبي كات | Copy Cat",
  },
  openGraph: {
    title: "مكتبة كوبي كات للطباعة والتصوير والادوات المكتبية | Copy Cat Print",
    description:
      "مكتبة كوبي كات (Copy Cat) - أفضل خدمات تصوير وطباعة وتجهيز مستندات وبطاقات وصور شخصية ومستلزمات مكتبية بأعلى جودة وأسرع تسليم.",
    url: baseUrl,
    siteName: "مكتبة كوبي كات | Copy Cat",
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "/logo.jpg",
        width: 800,
        height: 800,
        alt: "شعار مكتبة كوبي كات للطباعة والخدمات Copy Cat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "مكتبة كوبي كات للطباعة والتصوير والادوات المكتبية | Copy Cat",
    description:
      "مكتبة كوبي كات (Copy Cat) - تصوير وطباعة متطورة واستوديو صور شخصية 4x6 وبطاقات الرقم القومي ومستلزمات مكتبية.",
    images: ["/logo.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google:
      process.env.GOOGLE_SITE_VERIFICATION ||
      "45CwlQo0Fk1QKL796kCc0ZRO2Kd-n9cq2m1JHmzNjnk",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "مكتبة كوبي كات للطباعة والتصوير والادوات المكتبية | Copy Cat",
  "alternateName": ["Copy Cat", "كوبي كات", "مكتبة كوبي كات"],
  "image": `${baseUrl}/logo.jpg`,
  "logo": `${baseUrl}/logo.jpg`,
  "url": baseUrl,
  "telephone": "+201016629986",
  "priceRange": "$",
  "description": "مركز متكامل لخدمات التصوير والطباعة الرقمية، استوديو الصور الشخصية 4x6، تجهيز بطاقات الرقم القومي A5، تجليد الأبحاث، والمستلزمات المكتبية.",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "EG",
    "addressLocality": "Egypt"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 30.0444,
    "longitude": 31.2357
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Saturday",
      "Sunday"
    ],
    "opens": "09:00",
    "closes": "22:00"
  },
  "sameAs": [
    "https://wa.me/201016629986"
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon-48.png" type="image/png" sizes="48x48" />
        <link rel="icon" href="/icon-96.png" type="image/png" sizes="96x96" />
        <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {process.env.GOOGLE_SITE_VERIFICATION && (
          <meta
            name="google-site-verification"
            content={process.env.GOOGLE_SITE_VERIFICATION}
          />
        )}
      </head>
      <body
        className="font-sans min-h-screen selection:bg-blue-600 selection:text-white antialiased"
        suppressHydrationWarning
      >
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
