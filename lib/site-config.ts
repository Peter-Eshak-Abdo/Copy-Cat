/**
 * Centralized Site Configuration
 * Loads contact, social media, and location details from environment variables
 * to ensure sensitive personal numbers and URLs are never hardcoded in source files.
 */

export const SITE_CONFIG = {
  engineer: {
    phone: process.env.NEXT_PUBLIC_ENGINEER_PHONE || "01206385464",
    phoneIntl: process.env.NEXT_PUBLIC_ENGINEER_PHONE_INTL || "201206385464",
  },
  store: {
    phone: process.env.NEXT_PUBLIC_STORE_PHONE || "01210571251",
    phoneIntl: process.env.NEXT_PUBLIC_STORE_PHONE_INTL || "201210571251",
    address:
      process.env.NEXT_PUBLIC_STORE_ADDRESS ||
      "شارع الدقهلية بالقرب من مسجد المطافي أمام مركز نور الحياة - عرايشية مصر - الإسماعيلية",
    facebookUrl:
      process.env.NEXT_PUBLIC_FACEBOOK_URL ||
      "https://www.facebook.com/p/%D9%83%D9%88%D8%A8%D9%89-%D9%83%D8%A7%D8%AA-100090709554990/",
  },
} as const;
