import type { Metadata } from "next";
import { DEFAULT_FAQ, type FaqItem } from "@/lib/faq";
import { getFaqList } from "@/lib/server/settings";
import { FaqChat } from "./faq-chat";

export const metadata: Metadata = {
  title: "أسئلة شائعة عن الطباعة والتصوير والأدوات المكتبية",
  description:
    "إجابات أسئلة زباين مكتبة كوبي كات بالإسماعيلية: إرسال الملفات للطباعة، الألوان، صور 4×6، تصوير البطاقة، الأدوات المكتبية، المواعيد والطلب على الواتساب.",
  alternates: { canonical: "/faq" },
};

// The list is edited from /admin/faq; the page re-reads it every few minutes (and the browser refreshes it too)
export const revalidate = 300;

export default async function FaqPage() {
  let items: FaqItem[] = DEFAULT_FAQ;
  try {
    items = (await getFaqList()) ?? DEFAULT_FAQ;
  } catch {
    // No database: the built-in list
  }
  // Search engines show these answers right in the results
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })),
  }).replace(/</g, "\\u003c");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <FaqChat initial={items} />
    </>
  );
}
