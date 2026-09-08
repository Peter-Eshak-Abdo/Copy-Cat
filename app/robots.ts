import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const getBaseUrl = () => {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "https://copy-cat-kappa.vercel.app";
  };

  const baseUrl = getBaseUrl().replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/logo.jpg",
          "/favicon.ico",
          "/icon.png",
          "/icon-48.png",
          "/icon-96.png",
          "/icon-192.png",
          "/icon-512.png",
          "/apple-touch-icon.png",
          "/manifest.json",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/admin/*",
          "/login",
          "/login/",
          "/login/*",
          "/api",
          "/api/",
          "/api/*",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
