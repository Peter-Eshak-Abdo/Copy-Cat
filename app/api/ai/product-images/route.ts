import { NextRequest, NextResponse } from "next/server";

interface ImageSearchResult {
  title: string;
  url: string;
  thumbnail: string;
}

// Fallback high quality stationery images organized by category / topic
const CATEGORY_IMAGE_REGISTRY: Record<string, string[]> = {
  "أقلام جاف وجل": [
    "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1569683795645-b62e50fbf103?auto=format&fit=crop&w=800&q=80",
  ],
  "أقلام رصاص وسنون": [
    "https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80",
  ],
  "ماركر وفسفوري وتصحيح": [
    "https://images.unsplash.com/photo-1596541223130-5d31a73fb6c6?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=800&q=80",
  ],
  "ألوان وتلوين": [
    "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1596541223130-5d31a73fb6c6?auto=format&fit=crop&w=800&q=80",
  ],
  "برايات ومحايات": [
    "https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80",
  ],
  "كشاكيل ودفاتر وسلك": [
    "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=800&q=80",
  ],
  "ورق وخامات فنية": [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80",
  ],
  "ملفات وحوافظ": [
    "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1512314889357-e157c22f938d?auto=format&fit=crop&w=800&q=80",
  ],
  "لواصق وسوليتيب ودبابيس": [
    "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1512314889357-e157c22f938d?auto=format&fit=crop&w=800&q=80",
  ],
  "أدوات هندسية وحسابية": [
    "https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1611348586804-61bf6c080437?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=800&q=80",
  ],
  "أدوات ومستلزمات عامة": [
    "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
  ],
  "حقائب ومقالم": [
    "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80",
  ],
  "خدمات وطباعة": [
    "https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80",
  ],
  "عام": [
    "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=800&q=80",
  ]
};

async function searchWikimediaCommons(query: string, limit = 5): Promise<ImageSearchResult[]> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      query + " filetype:bitmap"
    )}&gsrlimit=${limit}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json`;

    const res = await fetch(url, {
      headers: { "User-Agent": "CopyCatStationery/1.0 (info@copycat.com)" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {}) as Array<{
      title?: string;
      imageinfo?: Array<{ url?: string; thumburl?: string }>;
    }>;

    return pages
      .map((p) => {
        const info = p.imageinfo?.[0];
        const imgUrl = info?.thumburl || info?.url;
        if (!imgUrl) return null;
        // avoid SVG or pdf
        if (imgUrl.endsWith(".svg") || imgUrl.endsWith(".pdf") || imgUrl.endsWith(".djvu")) return null;
        return {
          title: (p.title || "").replace(/^File:/, "").replace(/\.[^/.]+$/, ""),
          url: imgUrl,
          thumbnail: imgUrl,
        };
      })
      .filter((item): item is ImageSearchResult => item !== null);
  } catch (err) {
    console.error("Wikimedia search error:", err);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, category, notes, imageBase64 } = await req.json();

    let detectedName = name || "";
    let detectedCategory = category || "";
    let searchTerms: string[] = [];

    const geminiKey = process.env.GEMINI_API_KEY;

    // Step 1: If an image was taken by phone, ask Gemini Vision to identify the product
    if (imageBase64 && geminiKey && geminiKey.length > 10) {
      try {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

        const prompt = `You are an expert stationery and printing shop product identifier.
Analyze this photo taken with a mobile phone of a stationery/bookstore product.
Current product title entered: "${name || "Unknown"}"
Current category: "${category || "General"}"
Notes: "${notes || ""}"

Respond ONLY with a valid JSON object in this exact format:
{
  "productName": "precise name of the product in Arabic",
  "brand": "brand if recognized (e.g. Prima, Faber-Castell, Casio, Deli, Amazon) or null",
  "searchQueries": [
    "3 to 4 English search terms suitable for finding clean e-commerce product photos, e.g. 'Casio FX-991 scientific calculator white background', 'spiral A4 notebook', 'ballpoint pen blue'"
  ],
  "matchedCategory": "one of: أقلام جاف وجل, أقلام رصاص وسنون, ماركر وفسفوري وتصحيح, ألوان وتلوين, برايات ومحايات, كشاكيل ودفاتر وسلك, ورق وخامات فنية, ملفات وحوافظ, لواصق وسوليتيب ودبابيس, أدوات هندسية وحسابية, أدوات ومستلزمات عامة, حقائب ومقالم, خدمات وطباعة, عام"
}`;

        const gRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
                ],
              },
            ],
            generationConfig: { responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (gRes.ok) {
          const gData = await gRes.json();
          const rawText = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.searchQueries && Array.isArray(parsed.searchQueries)) {
              searchTerms = parsed.searchQueries;
            }
            if (parsed.productName && (!detectedName || detectedName === "صنف جديد")) {
              detectedName = parsed.productName;
            }
            if (parsed.matchedCategory) {
              detectedCategory = parsed.matchedCategory;
            }
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini vision analysis fallback:", geminiErr);
      }
    }

    // Step 2: If no search terms from Gemini Vision, generate intelligent search terms from name and category
    if (searchTerms.length === 0) {
      const q = (name || "").trim();
      if (/حاسب|calculator/i.test(q)) {
        searchTerms = ["scientific calculator", "pocket calculator", "Casio calculator"];
        detectedCategory = "أدوات هندسية وحسابية";
      } else if (/كشكول|دفتر|كراسة|سلك|امازون|A4/i.test(q)) {
        searchTerms = ["spiral notebook A4", "ruled notebook", "writing pad notebook"];
        detectedCategory = "كشاكيل ودفاتر وسلك";
      } else if (/قلم.*جاف|بريما|رينولدز|لينك/i.test(q)) {
        searchTerms = ["ballpoint pen", "blue ballpoint pen", "retractable ballpoint pen"];
        detectedCategory = "أقلام جاف وجل";
      } else if (/قلم.*رصاص|سنون/i.test(q)) {
        searchTerms = ["mechanical pencil", "graphite pencil HB", "pencil lead refill"];
        detectedCategory = "أقلام رصاص وسنون";
      } else if (/ماركر|فسفوري|هايلايتر/i.test(q)) {
        searchTerms = ["highlighter pen", "fluorescent marker", "whiteboard marker"];
        detectedCategory = "ماركر وفسفوري وتصحيح";
      } else if (/كوريكتور|مصحح/i.test(q)) {
        searchTerms = ["correction tape", "correction fluid pen"];
        detectedCategory = "ماركر وفسفوري وتصحيح";
      } else if (/ألوان|خشب|شمع|فلوماستر/i.test(q)) {
        searchTerms = ["colored pencils set", "crayons stationery", "sketching pencils"];
        detectedCategory = "ألوان وتلوين";
      } else if (/أستيكة|ممحاة|براية/i.test(q)) {
        searchTerms = ["pencil sharpener", "rubber eraser stationery"];
        detectedCategory = "برايات ومحايات";
      } else if (/ملف|دوسيه|حافظة|سنادة/i.test(q)) {
        searchTerms = ["clipboard stationery", "lever arch file", "plastic document folder"];
        detectedCategory = "ملفات وحوافظ";
      } else if (/صمغ|سوليتيب|دبل فيس|لاصق|شريط/i.test(q)) {
        searchTerms = ["glue stick", "adhesive tape roll", "craft glue"];
        detectedCategory = "لواصق وسوليتيب ودبابيس";
      } else if (/دباسة|خرامة|مقص|كاتر/i.test(q)) {
        searchTerms = ["stapler office", "hole puncher", "stationery scissors"];
        detectedCategory = "أدوات ومستلزمات عامة";
      } else if (/مقلمة|شنطة/i.test(q)) {
        searchTerms = ["pencil case zipper", "stationery pouch"];
        detectedCategory = "حقائب ومقالم";
      } else if (/ورق|فلوسكاب|كريب|كانسون/i.test(q)) {
        searchTerms = ["paper ream white", "craft paper sheet", "sketch paper"];
        detectedCategory = "ورق وخامات فنية";
      } else {
        searchTerms = ["office stationery product", "school supplies"];
        detectedCategory = "عام";
      }
    }

    // Step 3: Perform live image search on Wikimedia Commons
    const gatheredImages: string[] = [];

    for (const term of searchTerms.slice(0, 3)) {
      const results = await searchWikimediaCommons(term, 4);
      for (const r of results) {
        if (!gatheredImages.includes(r.url)) {
          gatheredImages.push(r.url);
        }
      }
      if (gatheredImages.length >= 6) break;
    }

    // Step 4: If gathered images are fewer than 4, supplement from our curated category registry
    const registryCategory =
      CATEGORY_IMAGE_REGISTRY[detectedCategory] || CATEGORY_IMAGE_REGISTRY["عام"];

    for (const regUrl of registryCategory) {
      if (!gatheredImages.includes(regUrl)) {
        gatheredImages.push(regUrl);
      }
    }

    const mainImage = gatheredImages[0] || registryCategory[0];
    const galleryImages = gatheredImages.slice(1, 5);

    return NextResponse.json({
      success: true,
      productName: detectedName,
      matchedCategory: detectedCategory,
      mainImage,
      galleryImages,
      allImages: gatheredImages.slice(0, 6),
      suggestedQueries: searchTerms,
    });
  } catch (error) {
    console.error("AI product image search handler error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "حدث خطأ أثناء البحث عن صور المنتج.",
        mainImage: CATEGORY_IMAGE_REGISTRY["عام"][0],
        galleryImages: CATEGORY_IMAGE_REGISTRY["عام"].slice(1),
      },
      { status: 500 }
    );
  }
}
