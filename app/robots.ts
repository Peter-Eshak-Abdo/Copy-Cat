import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://copycat-center.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: ["Googlebot", "Googlebot-Image", "Bingbot", "Applebot"],
        allow: ["/", "/login", "/logo.jpg"],
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
