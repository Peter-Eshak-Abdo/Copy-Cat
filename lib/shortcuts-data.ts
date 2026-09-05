export interface WebShortcut {
  id: string;
  title: string;
  url: string;
  category: string;
  description?: string;
  isPopular?: boolean;
}

export const DEFAULT_SHORTCUT_CATEGORIES = [
  "الكل",
  "خدمات حكومية وبطاقات",
  "تقديمات وجامعات ومدارس",
  "تصميم ومونتاج وجرافيك",
  "كتب ومذكرات وملازم",
  "أدوات وملفات وأوفيس",
];

export const INITIAL_SHORTCUTS: WebShortcut[] = [
  {
    id: "sc-1",
    title: "بوابة مصر الرقمية",
    url: "https://digital.gov.eg",
    category: "خدمات حكومية وبطاقات",
    description: "استخراج بطاقات التموين، توثيق، وخدمات الأحوال المدنية",
    isPopular: true,
  },
  {
    id: "sc-2",
    title: "موقع التنسيق الإلكتروني",
    url: "https://tansik.digital.gov.eg",
    category: "تقديمات وجامعات ومدارس",
    description: "تنسيق الثانوية العامة والدبلومات والشهادات المعادلة والجامعات",
    isPopular: true,
  },
  {
    id: "sc-3",
    title: "موقع كانفا (Canva)",
    url: "https://www.canva.com",
    category: "تصميم ومونتاج وجرافيك",
    description: "تصميم السير الذاتية، البوسترات، وبطاقات الدعوة والكروت",
    isPopular: true,
  },
  {
    id: "sc-4",
    title: "موقع Remove.bg (عزل الخلفيات)",
    url: "https://www.remove.bg",
    category: "تصميم ومونتاج وجرافيك",
    description: "إزالة خلفية الصور بنقرة واحدة سريعة",
    isPopular: true,
  },
  {
    id: "sc-5",
    title: "بوابة الوظائف الحكومية",
    url: "https://jobs.caoa.gov.eg",
    category: "خدمات حكومية وبطاقات",
    description: "التقديم على مسابقات المعلمين والوظائف والجهات الحكومية",
    isPopular: true,
  },
  {
    id: "sc-6",
    title: "موقع I Love PDF",
    url: "https://www.ilovepdf.com",
    category: "أدوات وملفات وأوفيس",
    description: "دمج، ضغط، وتحويل ملفات PDF",
    isPopular: true,
  },
  {
    id: "sc-7",
    title: "موقع نتائج الامتحانات والشهادات",
    url: "https://moe.gov.eg",
    category: "تقديمات وجامعات ومدارس",
    description: "بوابة وزارة التربية والتعليم للنتائج وأكواد الطلاب",
  },
  {
    id: "sc-8",
    title: "موقع وتطبيق تصغير الصور (TinyPNG)",
    url: "https://tinypng.com",
    category: "أدوات وملفات وأوفيس",
    description: "ضغط حجم الصور لتقليل استهلاك النت وسرعة التقديم",
  },
];
