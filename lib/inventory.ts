export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  price: number;
  cost_price?: number;
  wholesale_price?: number;
  wholesale_min_qty?: number;
  stock_count: number;
  notes?: string;
  image?: string;
  images?: string[];
}

export function resolveSafeImages(name: string, category: string): string[] {
  const n = (name || "").toLowerCase().trim();
  const c = (category || "").toLowerCase().trim();

  // 1. Stickers & notebook name labels (استيكر وتيكت كراسات وأشكال كرتون للطلاب)
  if (
    n.includes("استيكر") ||
    n.includes("ستيكر") ||
    n.includes("تيكت") ||
    n.includes("تيكيت") ||
    n.includes("ملصق")
  ) {
    return ["/products/stickers.jpg"];
  }

  // 2. Lined exam folscap paper (ورق فلوسكاب مفرد ومجوز مسطر)
  if (n.includes("فلوسكاب") || n.includes("فلوسكات")) {
    return ["/products/folscap-paper.jpg"];
  }

  // 3. Crepe & Craft specialty paper (ورق كريب وجليتر وفوم)
  if (n.includes("كريب") || n.includes("جليتر") || n.includes("فوم")) {
    return ["/products/crepe-paper.jpg"];
  }

  // 4. Heavy Cardstock & Couche (ورق كوشيه وكانسون وجلوسي و300 جم)
  if (
    n.includes("كوشيه") ||
    n.includes("كانسون") ||
    n.includes("300") ||
    n.includes("جلوسي") ||
    n.includes("بريستول")
  ) {
    return ["/products/couche-paper.jpg"];
  }

  // 5. Highlighters & Markers (Checked before bags)
  if (
    n.includes("هايلايتر") ||
    n.includes("فسفوري") ||
    n.includes("ماركر") ||
    n.includes("فلوماستر") ||
    n.includes("تلوين") ||
    n.includes("ألوان") ||
    n.includes("الوان")
  ) {
    return ["/products/coloring-set.jpg"];
  }

  // 6. Ping pong and tennis balls & toys
  if (n.includes("بنج") || n.includes("بينج")) {
    return ["/products/pingpong-balls.jpg"];
  }
  if (n.includes("تنس")) {
    return ["/products/tennis-ball.jpg"];
  }

  // 7. Pencil cases (مقالم) - MUST COME BEFORE قلم!
  if (n.includes("مقلمة حديد") || n.includes("مقلمة صاج")) {
    return ["/products/pencil-case-metal.jpg"];
  }
  if (n.includes("مقلمة")) {
    return ["/products/pencil-case.jpg"];
  }

  // 8. Fineliner & drawing pens
  if (n.includes("تسطير") || n.includes("فينلاينر") || n.includes("تحبير")) {
    return ["/products/fineliner-pens.jpg"];
  }

  // 9. Bags: Fabric / tuition bags vs Backpacks
  if (n.includes("شنطة قماش") || n.includes("شنطة دروس") || n.includes("دروس")) {
    return ["/products/tote-bag.jpg"];
  }
  if (n.includes("شنطة ظهر") || n.includes("باك باك") || c.includes("حقائب")) {
    return ["/products/school-backpack.jpg"];
  }

  // 10. Sticky notes
  if (n.includes("استيكي نوت") || n.includes("استيك نوت") || n.includes("ستيكي نوت")) {
    return ["/products/sticky-notes.jpg"];
  }

  // 11. Glue gun & adhesives
  if (
    n.includes("مسدس شمع") ||
    n.includes("شمع صغير") ||
    n.includes("شمع كبير") ||
    n.includes("صاروخ") ||
    n.includes("سوبر جلو")
  ) {
    return ["/products/glue-gun.jpg"];
  }
  if (n.includes("استيك فلوس") || n.includes("أستيك فلوس")) {
    return ["/products/rubber-bands.jpg"];
  }

  // 12. Cutters & scissors
  if (n.includes("قطر") || n.includes("كتر") || n.includes("مقص")) {
    return ["/products/utility-cutter.jpg"];
  }

  // 13. ID Lanyards & Badges
  if (
    n.includes("علاقة id") ||
    n.includes("كارنية id") ||
    n.includes("شريط رقبة") ||
    n.includes("علاقة")
  ) {
    return ["/products/lanyard-badge.jpg"];
  }

  // 14. Socks / apparel
  if (n.includes("شراب") || c.includes("ملبوسات")) {
    return ["/products/socks.jpg"];
  }

  // 15. Pencils, leads, sharpeners, erasers (استيكة وممحاة وبراية)
  if (
    n.includes("رصاص") ||
    n.includes("سنون") ||
    n.includes("براية") ||
    n.includes("أستيكة") ||
    n.includes("استيكة") ||
    n.includes("ممحاة")
  ) {
    return ["/products/wooden-pencils.jpg"];
  }

  // 16. Studio Passport Photos 4x6
  if (n.includes("شخصية") || n.includes("4x6") || n.includes("4*6") || n.includes("كوداك")) {
    return ["/products/passport-photos.jpg"];
  }

  // 17. ID Lamination A5
  if (
    n.includes("تغليف") ||
    n.includes("كارنيه") ||
    n.includes("بطاقة") ||
    n.includes("سلوفان")
  ) {
    return ["/products/laminated-id.jpg"];
  }

  // 18. Academic thesis / document printing & binding
  if (
    n.includes("بحث") ||
    n.includes("تجليد") ||
    n.includes("مذكرة") ||
    n.includes("مذكرات") ||
    n.includes("طباعة")
  ) {
    return ["/products/academic-thesis.jpg"];
  }

  // 19. Standard Copy Paper (Double A)
  if (
    n.includes("ورق تصوير") ||
    n.includes("دبل ايه") ||
    n.includes("دبل إيه") ||
    n.includes("80 جم") ||
    n.includes("70 جم")
  ) {
    return ["/products/double-a-paper.jpg"];
  }

  // 20. Files & Folders
  if (
    c.includes("ملفات") ||
    n.includes("ملف") ||
    n.includes("دوسيه") ||
    n.includes("حافظة") ||
    n.includes("سوستة") ||
    n.includes("ظرف") ||
    n.includes("سناد")
  ) {
    return ["/products/zipper-folder.jpg"];
  }

  // 21. Calculators
  if (n.includes("حاسب") || n.includes("كاسيو") || n.includes("fx-") || n.includes("آلة")) {
    return ["/products/scientific-calculator.jpg"];
  }

  // 22. Notebooks & Copybooks
  if (
    c.includes("كشاكيل") ||
    n.includes("كشكول") ||
    n.includes("دفتر") ||
    n.includes("سلك") ||
    n.includes("كراسة") ||
    n.includes("امازون")
  ) {
    return ["/products/spiral-notebook.jpg"];
  }

  // 23. Geometry & Rulers
  if (
    n.includes("مسطرة") ||
    n.includes("هندس") ||
    n.includes("برجل") ||
    n.includes("فرجار") ||
    n.includes("منقلة") ||
    n.includes("مثلث")
  ) {
    return ["/products/geometry-set.jpg"];
  }

  // 24. Office Supplies (Staplers, Pins)
  if (
    n.includes("دباس") ||
    n.includes("دبوس") ||
    n.includes("خرام") ||
    n.includes("كلبس")
  ) {
    return ["/products/office-stapler.jpg"];
  }

  // 25. Pens
  if (
    n.includes("قلم") ||
    n.includes("روتو") ||
    n.includes("بريما") ||
    n.includes("بيك") ||
    n.includes("جاف") ||
    n.includes("حبر") ||
    n.includes("جل") ||
    c.includes("كتابة")
  ) {
    return ["/products/blue-pen.jpg"];
  }

  // 26. Party & Gifts
  if (
    n.includes("عيد ميلاد") ||
    n.includes("مغناطيس") ||
    n.includes("بازل") ||
    c.includes("هدايا")
  ) {
    return ["/products/party-gifts.jpg"];
  }

  // Clean empty fallback - DO NOT force a random product image
  return [];
}

export function sanitizeItem(item: InventoryItem): InventoryItem {
  const isGenericOrBroken =
    item.image?.includes("wikimedia.org") ||
    item.image?.includes("unsplash.com") ||
    item.image?.includes("undefined") ||
    item.image?.includes("null");

  if (isGenericOrBroken) {
    const safe = resolveSafeImages(item.name, item.category);
    return {
      ...item,
      image: safe[0] || "",
      images: safe,
    };
  }

  return item;
}

export const INITIAL_PRODUCTS: InventoryItem[] = [
  {
    "id": 1,
    "name": "طباعة وتغليف بطاقة / كارنيه وش وضهر A5",
    "category": "خدمات وطباعة",
    "price": 15,
    "stock_count": 999,
    "notes": "سلوفان حراري فوري لحماية الكروت والشهادات مقاس A5",
    "image": "/products/laminated-id.jpg",
    "images": [
      "/products/laminated-id.jpg"
    ]
  },
  {
    "id": 2,
    "name": "استوديو الصور الشخصية 4x6 (عدد 4 صور)",
    "category": "خدمات وطباعة",
    "price": 25,
    "stock_count": 999,
    "notes": "عزل خلفية فوري + طباعة ورق كوداك أصلي 4x6",
    "image": "/products/passport-photos.jpg",
    "images": [
      "/products/passport-photos.jpg"
    ]
  },
  {
    "id": 3,
    "name": "استوديو الصور الشخصية 4x6 (عدد 8 صور)",
    "category": "خدمات وطباعة",
    "price": 45,
    "stock_count": 999,
    "notes": "عرض الاستوديو المميز لتقديمات المدارس والجامعات والوظائف",
    "image": "/products/passport-photos.jpg",
    "images": [
      "/products/passport-photos.jpg"
    ]
  },
  {
    "id": 4,
    "name": "طباعة وتجليد بحث أكاديمي / جامعي (حتى 10 صفحات)",
    "category": "خدمات وطباعة",
    "price": 35,
    "stock_count": 999,
    "notes": "تنسيق وتجليد متكامل مع الغلاف والفهرس والمراجع",
    "image": "/products/academic-thesis.jpg",
    "images": [
      "/products/academic-thesis.jpg"
    ]
  },
  {
    "id": 5,
    "name": "تصوير وتفتيح مستندات ومذكرات (وجه واحد)",
    "category": "خدمات وطباعة",
    "price": 1,
    "stock_count": 999,
    "notes": "أعلى دقة تصوير مع تفتيح السواد ونقاء فائق للنصوص",
    "image": "/products/academic-thesis.jpg",
    "images": [
      "/products/academic-thesis.jpg"
    ]
  },
  {
    "id": 6,
    "name": "شرابات",
    "category": "ملبوسات وإكسسوار",
    "price": 12,
    "stock_count": 999,
    "image": "/products/socks.jpg",
    "images": [
      "/products/socks.jpg"
    ]
  },
  {
    "id": 7,
    "name": "شراب طويل",
    "category": "ملبوسات وإكسسوار",
    "price": 20,
    "stock_count": 999,
    "image": "/products/socks.jpg",
    "images": [
      "/products/socks.jpg"
    ]
  },
  {
    "id": 8,
    "name": "سناده كرتون",
    "category": "ملفات وحوافظ",
    "price": 20,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 9,
    "name": "سنادة خشب",
    "category": "ملفات وحوافظ",
    "price": 35,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 10,
    "name": "طباعة",
    "category": "خدمات وطباعة",
    "price": 5,
    "stock_count": 10,
    "notes": "سعر جملة/كمية: 45 ج.م",
    "image": "/products/academic-thesis.jpg",
    "images": [
      "/products/academic-thesis.jpg"
    ]
  },
  {
    "id": 11,
    "name": "استيكر",
    "category": "بطاقات ومطبوعات",
    "price": 5,
    "stock_count": 999,
    "image": "/products/stickers.jpg",
    "images": [
      "/products/stickers.jpg"
    ]
  },
  {
    "id": 12,
    "name": "تيكت استيكر",
    "category": "بطاقات ومطبوعات",
    "price": 2,
    "stock_count": 999,
    "image": "/products/stickers.jpg",
    "images": [
      "/products/stickers.jpg"
    ]
  },
  {
    "id": 13,
    "name": "استيكر كبير",
    "category": "بطاقات ومطبوعات",
    "price": 10,
    "stock_count": 999,
    "image": "/products/stickers.jpg",
    "images": [
      "/products/stickers.jpg"
    ]
  },
  {
    "id": 14,
    "name": "فرخ كريب عادي",
    "category": "ورق وخامات فنية",
    "price": 15,
    "stock_count": 999,
    "image": "/products/crepe-paper.jpg",
    "images": [
      "/products/crepe-paper.jpg"
    ]
  },
  {
    "id": 15,
    "name": "فرخ كريب جليتر",
    "category": "ورق وخامات فنية",
    "price": 25,
    "stock_count": 999,
    "image": "/products/crepe-paper.jpg",
    "images": [
      "/products/crepe-paper.jpg"
    ]
  },
  {
    "id": 16,
    "name": "فرخ كريب جليتر بيلزق",
    "category": "ورق وخامات فنية",
    "price": 28,
    "stock_count": 999,
    "image": "/products/crepe-paper.jpg",
    "images": [
      "/products/crepe-paper.jpg"
    ]
  },
  {
    "id": 17,
    "name": "ورقة فلوسكات مفرد",
    "category": "ورق وخامات فنية",
    "price": 0.5,
    "stock_count": 70,
    "notes": "سعر جملة/كمية: 28 ج.م",
    "image": "/products/folscap-paper.jpg",
    "images": [
      "/products/folscap-paper.jpg"
    ]
  },
  {
    "id": 18,
    "name": "ورقة فلوسكاب مجوز",
    "category": "ورق وخامات فنية",
    "price": 1,
    "stock_count": 35,
    "notes": "سعر جملة/كمية: 28 ج.م",
    "image": "/products/folscap-paper.jpg",
    "images": [
      "/products/folscap-paper.jpg"
    ]
  },
  {
    "id": 19,
    "name": "شنطة قماش مقاس 22*16",
    "category": "حقائب ومقالم",
    "price": 1,
    "stock_count": 999,
    "image": "/products/tote-bag.jpg",
    "images": [
      "/products/tote-bag.jpg"
    ]
  },
  {
    "id": 20,
    "name": "شنطة قماش مقاس 20*25",
    "category": "حقائب ومقالم",
    "price": 1.5,
    "stock_count": 999,
    "image": "/products/tote-bag.jpg",
    "images": [
      "/products/tote-bag.jpg"
    ]
  },
  {
    "id": 21,
    "name": "شنطة قماش مقاس 25*30",
    "category": "حقائب ومقالم",
    "price": 2,
    "stock_count": 999,
    "image": "/products/tote-bag.jpg",
    "images": [
      "/products/tote-bag.jpg"
    ]
  },
  {
    "id": 22,
    "name": "شنطة قماش مقاس30*30",
    "category": "حقائب ومقالم",
    "price": 3,
    "stock_count": 999,
    "image": "/products/tote-bag.jpg",
    "images": [
      "/products/tote-bag.jpg"
    ]
  },
  {
    "id": 23,
    "name": "شنطة قماش مقاس 30*40",
    "category": "حقائب ومقالم",
    "price": 4,
    "stock_count": 999,
    "image": "/products/tote-bag.jpg",
    "images": [
      "/products/tote-bag.jpg"
    ]
  },
  {
    "id": 24,
    "name": "شنطة قماش مقاس 40*40",
    "category": "حقائب ومقالم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/tote-bag.jpg",
    "images": [
      "/products/tote-bag.jpg"
    ]
  },
  {
    "id": 25,
    "name": "شنطة قماش مقاس 40*50",
    "category": "حقائب ومقالم",
    "price": 6,
    "stock_count": 999,
    "image": "/products/tote-bag.jpg",
    "images": [
      "/products/tote-bag.jpg"
    ]
  },
  {
    "id": 26,
    "name": "شنطة قماش مقاس 50*60",
    "category": "حقائب ومقالم",
    "price": 8,
    "stock_count": 999,
    "image": "/products/tote-bag.jpg",
    "images": [
      "/products/tote-bag.jpg"
    ]
  },
  {
    "id": 27,
    "name": "شنطة قماش مقاس 60*60",
    "category": "حقائب ومقالم",
    "price": 10,
    "stock_count": 999,
    "image": "/products/tote-bag.jpg",
    "images": [
      "/products/tote-bag.jpg"
    ]
  },
  {
    "id": 28,
    "name": "شنطة هدايا كرتون صغيره",
    "category": "ورق وخامات فنية",
    "price": 5,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 29,
    "name": "شنطة هدايا كرتون وسط",
    "category": "ورق وخامات فنية",
    "price": 7,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 30,
    "name": "شنطة هدايا كرتون وسط طويل",
    "category": "ورق وخامات فنية",
    "price": 15,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 31,
    "name": "شنطة هدايا كرتون كبيرة عرض",
    "category": "ورق وخامات فنية",
    "price": 30,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 32,
    "name": "شنطة هدايا كرتون كبيرة طول / كرافت",
    "category": "ورق وخامات فنية",
    "price": 20,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 33,
    "name": "دوسية سوستة A4",
    "category": "ملفات وحوافظ",
    "price": 15,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 34,
    "name": "دوسية سوستة B4",
    "category": "ملفات وحوافظ",
    "price": 20,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 35,
    "name": "دوسية سوستة A3",
    "category": "ملفات وحوافظ",
    "price": 25,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 36,
    "name": "شنطة دروس بلاستيك",
    "category": "حقائب ومقالم",
    "price": 35,
    "stock_count": 999,
    "image": "/products/tote-bag.jpg",
    "images": [
      "/products/tote-bag.jpg"
    ]
  },
  {
    "id": 37,
    "name": "شنطة دروس قماش ضهر",
    "category": "حقائب ومقالم",
    "price": 80,
    "stock_count": 999,
    "image": "/products/tote-bag.jpg",
    "images": [
      "/products/tote-bag.jpg"
    ]
  },
  {
    "id": 38,
    "name": "ارقام مغناطيس",
    "category": "هدايا وألعاب",
    "price": 30,
    "stock_count": 999,
    "image": "/products/party-gifts.jpg",
    "images": [
      "/products/party-gifts.jpg"
    ]
  },
  {
    "id": 39,
    "name": "ارقام /حروف عربي/حروف E كريب",
    "category": "ورق وخامات فنية",
    "price": 10,
    "stock_count": 999,
    "image": "/products/crepe-paper.jpg",
    "images": [
      "/products/crepe-paper.jpg"
    ]
  },
  {
    "id": 40,
    "name": "الوان شمع للوش",
    "category": "أدوات كتابة ورسم",
    "price": 35,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 41,
    "name": "مسدس شمع صغير",
    "category": "لواصق ومثبتات",
    "price": 75,
    "stock_count": 999,
    "image": "/products/glue-gun.jpg",
    "images": [
      "/products/glue-gun.jpg"
    ]
  },
  {
    "id": 42,
    "name": "مسدس شمع كبير",
    "category": "لواصق ومثبتات",
    "price": 140,
    "stock_count": 999,
    "image": "/products/glue-gun.jpg",
    "images": [
      "/products/glue-gun.jpg"
    ]
  },
  {
    "id": 43,
    "name": "لزق صاروخ",
    "category": "لواصق ومثبتات",
    "price": 7,
    "stock_count": 12,
    "notes": "سعر جملة/كمية: 60 ج.م",
    "image": "/products/glue-gun.jpg",
    "images": [
      "/products/glue-gun.jpg"
    ]
  },
  {
    "id": 44,
    "name": "لزق صاروخ مادتين",
    "category": "لواصق ومثبتات",
    "price": 15,
    "stock_count": 999,
    "image": "/products/glue-gun.jpg",
    "images": [
      "/products/glue-gun.jpg"
    ]
  },
  {
    "id": 45,
    "name": "صلصال عادي صغير",
    "category": "ورق وخامات فنية",
    "price": 12,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 46,
    "name": "صلصال عادي كبير",
    "category": "ورق وخامات فنية",
    "price": 30,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 47,
    "name": "صلصال فوم صغير",
    "category": "ورق وخامات فنية",
    "price": 20,
    "stock_count": 999,
    "image": "/products/crepe-paper.jpg",
    "images": [
      "/products/crepe-paper.jpg"
    ]
  },
  {
    "id": 48,
    "name": "جليتر صغير",
    "category": "ورق وخامات فنية",
    "price": 3,
    "stock_count": 999,
    "image": "/products/crepe-paper.jpg",
    "images": [
      "/products/crepe-paper.jpg"
    ]
  },
  {
    "id": 49,
    "name": "جليتر كبير",
    "category": "ورق وخامات فنية",
    "price": 6,
    "stock_count": 999,
    "image": "/products/crepe-paper.jpg",
    "images": [
      "/products/crepe-paper.jpg"
    ]
  },
  {
    "id": 50,
    "name": "علاقة ID ازرق-اخضر-اصفر-احمر-رمادي-اسود",
    "category": "بطاقات ومطبوعات",
    "price": 8,
    "stock_count": 999,
    "image": "/products/lanyard-badge.jpg",
    "images": [
      "/products/lanyard-badge.jpg"
    ]
  },
  {
    "id": 51,
    "name": "كارنية ID ازرق-برتقاني-اسود-ابيض",
    "category": "بطاقات ومطبوعات",
    "price": 7,
    "stock_count": 999,
    "image": "/products/lanyard-badge.jpg",
    "images": [
      "/products/lanyard-badge.jpg"
    ]
  },
  {
    "id": 52,
    "name": "فرخ لوح ابيض-ازرق-بمبي-اخضر-اصفر",
    "category": "ورق وخامات فنية",
    "price": 10,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 53,
    "name": "فرخ كانسون صغير",
    "category": "ورق وخامات فنية",
    "price": 15,
    "stock_count": 999,
    "image": "/products/couche-paper.jpg",
    "images": [
      "/products/couche-paper.jpg"
    ]
  },
  {
    "id": 54,
    "name": "فرخ كانسون كبير",
    "category": "ورق وخامات فنية",
    "price": 25,
    "stock_count": 999,
    "image": "/products/couche-paper.jpg",
    "images": [
      "/products/couche-paper.jpg"
    ]
  },
  {
    "id": 55,
    "name": "علبة دوات هندسية",
    "category": "أدوات هندسية وحسابية",
    "price": 40,
    "stock_count": 999,
    "image": "/products/geometry-set.jpg",
    "images": [
      "/products/geometry-set.jpg"
    ]
  },
  {
    "id": 56,
    "name": "قطر صغير",
    "category": "أدوات ومستلزمات عامة",
    "price": 10,
    "stock_count": 999,
    "image": "/products/utility-cutter.jpg",
    "images": [
      "/products/utility-cutter.jpg"
    ]
  },
  {
    "id": 57,
    "name": "قطر كبير",
    "category": "أدوات ومستلزمات عامة",
    "price": 25,
    "stock_count": 999,
    "image": "/products/utility-cutter.jpg",
    "images": [
      "/products/utility-cutter.jpg"
    ]
  },
  {
    "id": 58,
    "name": "برجل رصاص - سنون",
    "category": "أدوات هندسية وحسابية",
    "price": 15,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 59,
    "name": "دبل فيس سيليكون شفاف",
    "category": "ورق وخامات فنية",
    "price": 20,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 60,
    "name": "دبل فيس فوم",
    "category": "ورق وخامات فنية",
    "price": 10,
    "stock_count": 999,
    "image": "/products/crepe-paper.jpg",
    "images": [
      "/products/crepe-paper.jpg"
    ]
  },
  {
    "id": 61,
    "name": "استيك فلوس عادي",
    "category": "لواصق ومثبتات",
    "price": 10,
    "stock_count": 999,
    "image": "/products/rubber-bands.jpg",
    "images": [
      "/products/rubber-bands.jpg"
    ]
  },
  {
    "id": 62,
    "name": "استيك فلوس كبير",
    "category": "لواصق ومثبتات",
    "price": 12,
    "stock_count": 999,
    "image": "/products/rubber-bands.jpg",
    "images": [
      "/products/rubber-bands.jpg"
    ]
  },
  {
    "id": 63,
    "name": "عصاية استيك صغيره عادي",
    "category": "أدوات ومستلزمات عامة",
    "price": 15,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 64,
    "name": "عصاية استيك صغيره ملون",
    "category": "أدوات ومستلزمات عامة",
    "price": 15,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 65,
    "name": "عصاية استيك كبيره عادي",
    "category": "أدوات ومستلزمات عامة",
    "price": 25,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 66,
    "name": "عصاية استيك كبيره ملون",
    "category": "أدوات ومستلزمات عامة",
    "price": 25,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 67,
    "name": "شمع أعياد ميلاد",
    "category": "لواصق ومثبتات",
    "price": 20,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 68,
    "name": "عيد ميلاد سعيد",
    "category": "هدايا وألعاب",
    "price": 10,
    "stock_count": 999,
    "image": "/products/party-gifts.jpg",
    "images": [
      "/products/party-gifts.jpg"
    ]
  },
  {
    "id": 69,
    "name": "آلة حاسبة كاسيو fx-991ES Plus تقليد",
    "category": "أدوات هندسية وحسابية",
    "price": 350,
    "stock_count": 999,
    "image": "/products/scientific-calculator.jpg",
    "images": [
      "/products/scientific-calculator.jpg"
    ]
  },
  {
    "id": 70,
    "name": "آلة حاسبة كاسيو fx-991ES Plus اصل",
    "category": "أدوات هندسية وحسابية",
    "price": 925,
    "stock_count": 999,
    "image": "/products/scientific-calculator.jpg",
    "images": [
      "/products/scientific-calculator.jpg"
    ]
  },
  {
    "id": 71,
    "name": "مقلمة كبيره",
    "category": "أدوات كتابة ورسم",
    "price": 140,
    "stock_count": 999,
    "image": "/products/pencil-case.jpg",
    "images": [
      "/products/pencil-case.jpg"
    ]
  },
  {
    "id": 72,
    "name": "مقلمة خفيفة كبير",
    "category": "أدوات كتابة ورسم",
    "price": 12,
    "stock_count": 999,
    "image": "/products/pencil-case.jpg",
    "images": [
      "/products/pencil-case.jpg"
    ]
  },
  {
    "id": 73,
    "name": "مقلمة سوستة صغير",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/pencil-case.jpg",
    "images": [
      "/products/pencil-case.jpg"
    ]
  },
  {
    "id": 74,
    "name": "مقلمة سوستة الوان",
    "category": "أدوات كتابة ورسم",
    "price": 10,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 75,
    "name": "كورة تنس",
    "category": "هدايا وألعاب",
    "price": 25,
    "stock_count": 999,
    "image": "/products/tennis-ball.jpg",
    "images": [
      "/products/tennis-ball.jpg"
    ]
  },
  {
    "id": 76,
    "name": "كورة بنج خفيفة",
    "category": "هدايا وألعاب",
    "price": 6,
    "stock_count": 999,
    "image": "/products/pingpong-balls.jpg",
    "images": [
      "/products/pingpong-balls.jpg"
    ]
  },
  {
    "id": 77,
    "name": "كورة بنج قوية",
    "category": "هدايا وألعاب",
    "price": 9,
    "stock_count": 999,
    "image": "/products/pingpong-balls.jpg",
    "images": [
      "/products/pingpong-balls.jpg"
    ]
  },
  {
    "id": 78,
    "name": "أقلام تسطير",
    "category": "أدوات كتابة ورسم",
    "price": 45,
    "stock_count": 999,
    "image": "/products/fineliner-pens.jpg",
    "images": [
      "/products/fineliner-pens.jpg"
    ]
  },
  {
    "id": 79,
    "name": "باكت 3اقلام هايلايتر",
    "category": "أدوات كتابة ورسم",
    "price": 15,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 80,
    "name": "مقلمة حديد صغيره",
    "category": "أدوات كتابة ورسم",
    "price": 25,
    "stock_count": 999,
    "image": "/products/pencil-case-metal.jpg",
    "images": [
      "/products/pencil-case-metal.jpg"
    ]
  },
  {
    "id": 81,
    "name": "مقلمة حديد كبيره",
    "category": "أدوات كتابة ورسم",
    "price": 35,
    "stock_count": 999,
    "image": "/products/pencil-case-metal.jpg",
    "images": [
      "/products/pencil-case-metal.jpg"
    ]
  },
  {
    "id": 82,
    "name": "مقلمة قماش",
    "category": "أدوات كتابة ورسم",
    "price": 25,
    "stock_count": 999,
    "image": "/products/pencil-case.jpg",
    "images": [
      "/products/pencil-case.jpg"
    ]
  },
  {
    "id": 83,
    "name": "مقلمة بلاستيك",
    "category": "أدوات كتابة ورسم",
    "price": 40,
    "stock_count": 999,
    "image": "/products/pencil-case.jpg",
    "images": [
      "/products/pencil-case.jpg"
    ]
  },
  {
    "id": 84,
    "name": "مقلمة قماش نضيفة",
    "category": "أدوات كتابة ورسم",
    "price": 60,
    "stock_count": 999,
    "image": "/products/pencil-case.jpg",
    "images": [
      "/products/pencil-case.jpg"
    ]
  },
  {
    "id": 85,
    "name": "مقلمة شكل قلم",
    "category": "أدوات كتابة ورسم",
    "price": 20,
    "stock_count": 999,
    "image": "/products/pencil-case.jpg",
    "images": [
      "/products/pencil-case.jpg"
    ]
  },
  {
    "id": 86,
    "name": "مقص وسط",
    "category": "أدوات كتابة ورسم",
    "price": 17,
    "stock_count": 999,
    "image": "/products/utility-cutter.jpg",
    "images": [
      "/products/utility-cutter.jpg"
    ]
  },
  {
    "id": 87,
    "name": "مقص كبير",
    "category": "أدوات كتابة ورسم",
    "price": 20,
    "stock_count": 999,
    "image": "/products/utility-cutter.jpg",
    "images": [
      "/products/utility-cutter.jpg"
    ]
  },
  {
    "id": 88,
    "name": "مقص صغير",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/utility-cutter.jpg",
    "images": [
      "/products/utility-cutter.jpg"
    ]
  },
  {
    "id": 89,
    "name": "كوريكتور لزق صغير",
    "category": "أدوات كتابة ورسم",
    "price": 15,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 90,
    "name": "كوريكتور لزق كبير",
    "category": "أدوات كتابة ورسم",
    "price": 20,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 91,
    "name": "كوريكتور صغير",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 92,
    "name": "كوريكتور وسط",
    "category": "أدوات كتابة ورسم",
    "price": 10,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 93,
    "name": "كوريكتور كبير",
    "category": "أدوات كتابة ورسم",
    "price": 15,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 94,
    "name": "استيكي نوت مسطر صغير",
    "category": "كشاكيل ودفاتر",
    "price": 10,
    "stock_count": 999,
    "image": "/products/sticky-notes.jpg",
    "images": [
      "/products/sticky-notes.jpg"
    ]
  },
  {
    "id": 95,
    "name": "استيكي نوت مسطر كبير",
    "category": "كشاكيل ودفاتر",
    "price": 15,
    "stock_count": 999,
    "image": "/products/sticky-notes.jpg",
    "images": [
      "/products/sticky-notes.jpg"
    ]
  },
  {
    "id": 96,
    "name": "استيكي نوت صغير",
    "category": "كشاكيل ودفاتر",
    "price": 10,
    "stock_count": 999,
    "image": "/products/sticky-notes.jpg",
    "images": [
      "/products/sticky-notes.jpg"
    ]
  },
  {
    "id": 97,
    "name": "استيكي نوت كبير",
    "category": "كشاكيل ودفاتر",
    "price": 15,
    "stock_count": 999,
    "image": "/products/sticky-notes.jpg",
    "images": [
      "/products/sticky-notes.jpg"
    ]
  },
  {
    "id": 98,
    "name": "بوك مارك",
    "category": "بطاقات ومطبوعات",
    "price": 10,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 99,
    "name": "هايلايتر فاتح",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 100,
    "name": "هايلايتر غامق",
    "category": "أدوات كتابة ورسم",
    "price": 8,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 101,
    "name": "أقلام جاف ملون 4",
    "category": "أدوات كتابة ورسم",
    "price": 14,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 102,
    "name": "أقلام جاف ملون 5",
    "category": "أدوات كتابة ورسم",
    "price": 17,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 103,
    "name": "أقلام جاف ملون 10",
    "category": "أدوات كتابة ورسم",
    "price": 30,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 104,
    "name": "أقلام جاف ملون 10 جليتر",
    "category": "أدوات كتابة ورسم",
    "price": 50,
    "stock_count": 999,
    "image": "/products/crepe-paper.jpg",
    "images": [
      "/products/crepe-paper.jpg"
    ]
  },
  {
    "id": 105,
    "name": "استيكة اشكال",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 106,
    "name": "الوان خشب 6 قصير بريما",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 107,
    "name": "الوان خشب 12 قصير بريما",
    "category": "أدوات كتابة ورسم",
    "price": 15,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 108,
    "name": "الوان خشب 12 قصير فيبر كاستل",
    "category": "أدوات كتابة ورسم",
    "price": 55,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 109,
    "name": "الوان خشب 12 قصير جيلسي",
    "category": "أدوات كتابة ورسم",
    "price": 15,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 110,
    "name": "الوان خشب 12 طوال جيلسي",
    "category": "أدوات كتابة ورسم",
    "price": 25,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 111,
    "name": "الوان خشب 12 قصير دومز",
    "category": "أدوات كتابة ورسم",
    "price": 20,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 112,
    "name": "الوان خشب 12 قصير باور",
    "category": "أدوات كتابة ورسم",
    "price": 20,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 113,
    "name": "الوان خشب 12 قصير راي سن",
    "category": "أدوات كتابة ورسم",
    "price": 25,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 114,
    "name": "الوان خشب 12 طوال بريما",
    "category": "أدوات كتابة ورسم",
    "price": 20,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 115,
    "name": "الوان خشب 12 طوال فيبر كاستل",
    "category": "أدوات كتابة ورسم",
    "price": 85,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 116,
    "name": "الوان خشب 12 طوال دومز",
    "category": "أدوات كتابة ورسم",
    "price": 35,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 117,
    "name": "الوان خشب 12 طوال 24 لون",
    "category": "أدوات كتابة ورسم",
    "price": 35,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 118,
    "name": "الوان فلومستر 6",
    "category": "أدوات كتابة ورسم",
    "price": 15,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 119,
    "name": "الوان فلومستر 12",
    "category": "أدوات كتابة ورسم",
    "price": 25,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 120,
    "name": "لالوان فلومستر 24",
    "category": "أدوات كتابة ورسم",
    "price": 60,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 121,
    "name": "الوان خشب 12 قصير دومز علبه",
    "category": "أدوات كتابة ورسم",
    "price": 25,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 122,
    "name": "الوان مياة",
    "category": "أدوات كتابة ورسم",
    "price": 15,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 123,
    "name": "جلو",
    "category": "لواصق ومثبتات",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 124,
    "name": "جلو احمر",
    "category": "لواصق ومثبتات",
    "price": 10,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 125,
    "name": "جلو لبني",
    "category": "لواصق ومثبتات",
    "price": 10,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 126,
    "name": "جلو كبير",
    "category": "لواصق ومثبتات",
    "price": 20,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 127,
    "name": "قلم صبورة اسود-احمر-ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 10,
    "stock_count": 12,
    "notes": "سعر جملة/كمية: 100 ج.م",
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 128,
    "name": "قلم ماركر اسود-احمر-ازرق-اخضر",
    "category": "أدوات كتابة ورسم",
    "price": 10,
    "stock_count": 12,
    "notes": "سعر جملة/كمية: 100 ج.م",
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 129,
    "name": "الوان شمع",
    "category": "أدوات كتابة ورسم",
    "price": 25,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 130,
    "name": "الوان شمع انضف",
    "category": "أدوات كتابة ورسم",
    "price": 35,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 131,
    "name": "بازل 3",
    "category": "هدايا وألعاب",
    "price": 20,
    "stock_count": 999,
    "image": "/products/party-gifts.jpg",
    "images": [
      "/products/party-gifts.jpg"
    ]
  },
  {
    "id": 132,
    "name": "قلم بينور",
    "category": "أدوات كتابة ورسم",
    "price": 10,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 133,
    "name": "قلم سنون 5-7-9 مم",
    "category": "أدوات كتابة ورسم",
    "price": 25,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 134,
    "name": "علبه سنون 5-7-9 HB-2B",
    "category": "أدوات كتابة ورسم",
    "price": 6,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 135,
    "name": "جاف شكل",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 136,
    "name": "رصاص سن بيتبدل",
    "category": "أدوات كتابة ورسم",
    "price": 9,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 137,
    "name": "سنون شكل",
    "category": "أدوات كتابة ورسم",
    "price": 15,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 138,
    "name": "قلم الوان صغير 4 الوان",
    "category": "أدوات كتابة ورسم",
    "price": 15,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 139,
    "name": "قلم الوان كبير 10 الوان",
    "category": "أدوات كتابة ورسم",
    "price": 20,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 140,
    "name": "جاف جزرة",
    "category": "أدوات كتابة ورسم",
    "price": 9,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 141,
    "name": "سنون 2مم",
    "category": "أدوات كتابة ورسم",
    "price": 9,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 142,
    "name": "جاف شكل محترم",
    "category": "أدوات كتابة ورسم",
    "price": 10,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 143,
    "name": "منقلة",
    "category": "أدوات هندسية وحسابية",
    "price": 5,
    "stock_count": 999,
    "image": "/products/geometry-set.jpg",
    "images": [
      "/products/geometry-set.jpg"
    ]
  },
  {
    "id": 144,
    "name": "مثلث 30 60",
    "category": "أدوات هندسية وحسابية",
    "price": 5,
    "stock_count": 999,
    "image": "/products/geometry-set.jpg",
    "images": [
      "/products/geometry-set.jpg"
    ]
  },
  {
    "id": 145,
    "name": "مسطرة فين",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/geometry-set.jpg",
    "images": [
      "/products/geometry-set.jpg"
    ]
  },
  {
    "id": 146,
    "name": "استيك نوت 3 مقسمة",
    "category": "كشاكيل ودفاتر",
    "price": 15,
    "stock_count": 999,
    "image": "/products/sticky-notes.jpg",
    "images": [
      "/products/sticky-notes.jpg"
    ]
  },
  {
    "id": 147,
    "name": "استيك نوت اشكال",
    "category": "كشاكيل ودفاتر",
    "price": 12,
    "stock_count": 999,
    "image": "/products/sticky-notes.jpg",
    "images": [
      "/products/sticky-notes.jpg"
    ]
  },
  {
    "id": 148,
    "name": "مسطرة دوائر",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/geometry-set.jpg",
    "images": [
      "/products/geometry-set.jpg"
    ]
  },
  {
    "id": 149,
    "name": "مسطرة دوائر اكبر",
    "category": "أدوات كتابة ورسم",
    "price": 12,
    "stock_count": 999,
    "image": "/products/geometry-set.jpg",
    "images": [
      "/products/geometry-set.jpg"
    ]
  },
  {
    "id": 150,
    "name": "قلم مكتب",
    "category": "أدوات كتابة ورسم",
    "price": 25,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 151,
    "name": "منقلة 360درجة",
    "category": "أدوات هندسية وحسابية",
    "price": 9,
    "stock_count": 999,
    "image": "/products/geometry-set.jpg",
    "images": [
      "/products/geometry-set.jpg"
    ]
  },
  {
    "id": 152,
    "name": "بادة ماوس صغيرة",
    "category": "أدوات ومستلزمات عامة",
    "price": 20,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 153,
    "name": "بادة ماوس كبير",
    "category": "أدوات ومستلزمات عامة",
    "price": 25,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 154,
    "name": "استيكر ليبولز",
    "category": "بطاقات ومطبوعات",
    "price": 10,
    "stock_count": 999,
    "image": "/products/stickers.jpg",
    "images": [
      "/products/stickers.jpg"
    ]
  },
  {
    "id": 155,
    "name": "كارت عيد",
    "category": "أدوات ومستلزمات عامة",
    "price": 3,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 156,
    "name": "مناديل",
    "category": "أدوات ومستلزمات عامة",
    "price": 3,
    "stock_count": 10,
    "notes": "سعر جملة/كمية: 20 ج.م",
    "image": "",
    "images": []
  },
  {
    "id": 157,
    "name": "استيكة فيبر كاستل صغيرة",
    "category": "أدوات كتابة ورسم",
    "price": 10,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 158,
    "name": "استيكة فيبر كاستل كبيرة",
    "category": "أدوات كتابة ورسم",
    "price": 15,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 159,
    "name": "منقلة سنون",
    "category": "أدوات هندسية وحسابية",
    "price": 40,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 160,
    "name": "دبابيس دباسة 24/6",
    "category": "لواصق ومثبتات",
    "price": 10,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 161,
    "name": "خرامة ورق صغيرة",
    "category": "ورق وخامات فنية",
    "price": 35,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 162,
    "name": "خرامة ورق كبيره",
    "category": "ورق وخامات فنية",
    "price": 120,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 163,
    "name": "لزق صاروخ",
    "category": "لواصق ومثبتات",
    "price": 7,
    "stock_count": 12,
    "notes": "سعر جملة/كمية: 60 ج.م",
    "image": "/products/glue-gun.jpg",
    "images": [
      "/products/glue-gun.jpg"
    ]
  },
  {
    "id": 164,
    "name": "صلصال فوم صغير",
    "category": "ورق وخامات فنية",
    "price": 20,
    "stock_count": 999,
    "image": "/products/crepe-paper.jpg",
    "images": [
      "/products/crepe-paper.jpg"
    ]
  },
  {
    "id": 165,
    "name": "شمع مسدس شمع صغير",
    "category": "لواصق ومثبتات",
    "price": 3,
    "stock_count": 999,
    "image": "/products/glue-gun.jpg",
    "images": [
      "/products/glue-gun.jpg"
    ]
  },
  {
    "id": 166,
    "name": "شمع مسدس شمع كبير",
    "category": "لواصق ومثبتات",
    "price": 5,
    "stock_count": 999,
    "image": "/products/glue-gun.jpg",
    "images": [
      "/products/glue-gun.jpg"
    ]
  },
  {
    "id": 167,
    "name": "سلاح قطر كبير",
    "category": "أدوات ومستلزمات عامة",
    "price": 2,
    "stock_count": 999,
    "image": "/products/utility-cutter.jpg",
    "images": [
      "/products/utility-cutter.jpg"
    ]
  },
  {
    "id": 168,
    "name": "آلة حاسبة مكتب صغيرة",
    "category": "أدوات هندسية وحسابية",
    "price": 115,
    "stock_count": 999,
    "image": "/products/scientific-calculator.jpg",
    "images": [
      "/products/scientific-calculator.jpg"
    ]
  },
  {
    "id": 169,
    "name": "آلة حاسبة كتب وسط",
    "category": "أدوات هندسية وحسابية",
    "price": 150,
    "stock_count": 999,
    "image": "/products/scientific-calculator.jpg",
    "images": [
      "/products/scientific-calculator.jpg"
    ]
  },
  {
    "id": 170,
    "name": "آلة حاسبة كبيرة",
    "category": "أدوات هندسية وحسابية",
    "price": 195,
    "stock_count": 999,
    "image": "/products/scientific-calculator.jpg",
    "images": [
      "/products/scientific-calculator.jpg"
    ]
  },
  {
    "id": 171,
    "name": "خلاعة دبابيس",
    "category": "لواصق ومثبتات",
    "price": 15,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 172,
    "name": "دبابيس مكتب",
    "category": "لواصق ومثبتات",
    "price": 5,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 173,
    "name": "دبوس مشبك صغير",
    "category": "أدوات ومستلزمات عامة",
    "price": 2,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 174,
    "name": "دبابيس دباسة 24/6 كنجارو",
    "category": "لواصق ومثبتات",
    "price": 18,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 175,
    "name": "لزق اسكوتش نص متر",
    "category": "لواصق ومثبتات",
    "price": 7,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 176,
    "name": "قلم خط عربي 3 مللي اسود-احمر",
    "category": "أدوات كتابة ورسم",
    "price": 8,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 177,
    "name": "مسطرة 50سم",
    "category": "أدوات كتابة ورسم",
    "price": 25,
    "stock_count": 999,
    "image": "/products/geometry-set.jpg",
    "images": [
      "/products/geometry-set.jpg"
    ]
  },
  {
    "id": 178,
    "name": "حجارة ايفرريدي ريموت ازرق",
    "category": "أدوات ومستلزمات عامة",
    "price": 10,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 179,
    "name": "حجارة ايفرريدي ريموت احمر",
    "category": "أدوات ومستلزمات عامة",
    "price": 25,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 180,
    "name": "حجارة ايفرريدي قلم ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 15,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 181,
    "name": "حجارة ايفرريدي قلم احمر",
    "category": "أدوات كتابة ورسم",
    "price": 25,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 182,
    "name": "حجارة ايفرريدي قلم اسود",
    "category": "أدوات كتابة ورسم",
    "price": 30,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 183,
    "name": "بكرة ستان رفيع احمر-بيض-اسود-لبني",
    "category": "أدوات ومستلزمات عامة",
    "price": 10,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 184,
    "name": "بكرة ستان عريض احمر-بيض-اسود-لبني",
    "category": "أدوات ومستلزمات عامة",
    "price": 14,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 185,
    "name": "ماوس",
    "category": "أدوات ومستلزمات عامة",
    "price": 70,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 186,
    "name": "كيبورده",
    "category": "أدوات ومستلزمات عامة",
    "price": 145,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 187,
    "name": "صفارة بلاستيك",
    "category": "أدوات ومستلزمات عامة",
    "price": 7,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 188,
    "name": "صفارة حديد",
    "category": "أدوات ومستلزمات عامة",
    "price": 10,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 189,
    "name": "لانشبوكس",
    "category": "أدوات ومستلزمات عامة",
    "price": 50,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 190,
    "name": "لزق عريض 80ياردة",
    "category": "لواصق ومثبتات",
    "price": 8,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 191,
    "name": "لزق عريض 100ياردة",
    "category": "لواصق ومثبتات",
    "price": 10,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 192,
    "name": "لزق عريض 150ياردة",
    "category": "لواصق ومثبتات",
    "price": 15,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 193,
    "name": "لزق عريض 200ياردة",
    "category": "لواصق ومثبتات",
    "price": 20,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 194,
    "name": "لزق عريض 300ياردة",
    "category": "لواصق ومثبتات",
    "price": 30,
    "stock_count": 999,
    "image": "/products/couche-paper.jpg",
    "images": [
      "/products/couche-paper.jpg"
    ]
  },
  {
    "id": 195,
    "name": "لزق صغير",
    "category": "لواصق ومثبتات",
    "price": 4,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 196,
    "name": "لزق صغير عريض",
    "category": "لواصق ومثبتات",
    "price": 5,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 197,
    "name": "لزق  شكرتون اسود",
    "category": "ورق وخامات فنية",
    "price": 5,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 198,
    "name": "لزق دهان",
    "category": "لواصق ومثبتات",
    "price": 6,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 199,
    "name": "لزق دهان عريض",
    "category": "لواصق ومثبتات",
    "price": 12,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 200,
    "name": "ظرف C6",
    "category": "ملفات وحوافظ",
    "price": 1,
    "stock_count": 100,
    "notes": "سعر جملة/كمية: 60 ج.م",
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 201,
    "name": "ظرف DL",
    "category": "ملفات وحوافظ",
    "price": 1,
    "stock_count": 50,
    "notes": "سعر جملة/كمية: 35 ج.م",
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 202,
    "name": "ظرف صغير ملون بامبي-ازرق",
    "category": "ملفات وحوافظ",
    "price": 0.5,
    "stock_count": 48,
    "notes": "سعر جملة/كمية: 12 ج.م",
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 203,
    "name": "ظرف فونتانا",
    "category": "ملفات وحوافظ",
    "price": 0.5,
    "stock_count": 48,
    "notes": "سعر جملة/كمية: 12 ج.م",
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 204,
    "name": "ظرف C5",
    "category": "ملفات وحوافظ",
    "price": 2,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 205,
    "name": "ظرف C4",
    "category": "ملفات وحوافظ",
    "price": 3,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 206,
    "name": "ظرف C3",
    "category": "ملفات وحوافظ",
    "price": 5,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 207,
    "name": "ظرف بني صغير",
    "category": "ملفات وحوافظ",
    "price": 3,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 208,
    "name": "ظرف بني وسط",
    "category": "ملفات وحوافظ",
    "price": 4,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 209,
    "name": "ظرف بني كبير",
    "category": "ملفات وحوافظ",
    "price": 5,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 210,
    "name": "نوتة صغير خالص",
    "category": "كشاكيل ودفاتر",
    "price": 3,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 211,
    "name": "نوتة صغير ة سلك",
    "category": "كشاكيل ودفاتر",
    "price": 10,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 212,
    "name": "نوتة صغيرة سلك هارد كافر",
    "category": "كشاكيل ودفاتر",
    "price": 20,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 213,
    "name": "نوتة صغيرة A6 سلك",
    "category": "كشاكيل ودفاتر",
    "price": 35,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 214,
    "name": "نوتة كبيرة هارد كافر",
    "category": "كشاكيل ودفاتر",
    "price": 80,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 215,
    "name": "تغليف هدايا",
    "category": "خدمات وطباعة",
    "price": 7,
    "stock_count": 999,
    "image": "/products/laminated-id.jpg",
    "images": [
      "/products/laminated-id.jpg"
    ]
  },
  {
    "id": 216,
    "name": "علم مصر صغير",
    "category": "أدوات ومستلزمات عامة",
    "price": 7,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 217,
    "name": "علم مصر وسط",
    "category": "أدوات ومستلزمات عامة",
    "price": 10,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 218,
    "name": "دباسة صغيرة",
    "category": "لواصق ومثبتات",
    "price": 25,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 219,
    "name": "دباسة صغيرة + خلاعة دبابيس",
    "category": "لواصق ومثبتات",
    "price": 35,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 220,
    "name": "دباسة وسط",
    "category": "لواصق ومثبتات",
    "price": 35,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 221,
    "name": "دباسة عادية 1",
    "category": "لواصق ومثبتات",
    "price": 70,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 222,
    "name": "ددباسة عادية 2",
    "category": "لواصق ومثبتات",
    "price": 95,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 223,
    "name": "دباسة كبيرة",
    "category": "لواصق ومثبتات",
    "price": 250,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 224,
    "name": "دباسة بوكليت",
    "category": "لواصق ومثبتات",
    "price": 170,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 225,
    "name": "دوسية أرشيف",
    "category": "ملفات وحوافظ",
    "price": 60,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 226,
    "name": "دوسية عادي 8سم",
    "category": "ملفات وحوافظ",
    "price": 45,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 227,
    "name": "دوسية صغير 4سم",
    "category": "ملفات وحوافظ",
    "price": 40,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 228,
    "name": "خرز",
    "category": "أدوات ومستلزمات عامة",
    "price": 45,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 229,
    "name": "شرابات أطفال",
    "category": "ملبوسات وإكسسوار",
    "price": 10,
    "stock_count": 999,
    "image": "/products/socks.jpg",
    "images": [
      "/products/socks.jpg"
    ]
  },
  {
    "id": 230,
    "name": "شربات",
    "category": "أدوات ومستلزمات عامة",
    "price": 12,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 231,
    "name": "شربات طويلة - تقيلة",
    "category": "أدوات ومستلزمات عامة",
    "price": 20,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 232,
    "name": "صلصال طين اسواني 250جم اسود",
    "category": "ورق وخامات فنية",
    "price": 10,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 233,
    "name": "صلصال طين اسواني 500جم اسود",
    "category": "ورق وخامات فنية",
    "price": 15,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 234,
    "name": "صلصال طين اسواني 1كم اسود",
    "category": "ورق وخامات فنية",
    "price": 25,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 235,
    "name": "صلصال طين اسواني 1كم ابيض",
    "category": "ورق وخامات فنية",
    "price": 30,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 236,
    "name": "صلصال طين اسواني 500جم اسود عالي",
    "category": "ورق وخامات فنية",
    "price": 45,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 237,
    "name": "صلصال طين اسواني 500جم ابيض عالي",
    "category": "ورق وخامات فنية",
    "price": 55,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 238,
    "name": "كراسة رسم كانسون 130جم",
    "category": "كشاكيل ودفاتر",
    "price": 35,
    "stock_count": 999,
    "image": "/products/couche-paper.jpg",
    "images": [
      "/products/couche-paper.jpg"
    ]
  },
  {
    "id": 239,
    "name": "كراسة رسم كانسون 200جم",
    "category": "كشاكيل ودفاتر",
    "price": 40,
    "stock_count": 999,
    "image": "/products/couche-paper.jpg",
    "images": [
      "/products/couche-paper.jpg"
    ]
  },
  {
    "id": 240,
    "name": "كراسة رسم كبيرة",
    "category": "كشاكيل ودفاتر",
    "price": 17,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 241,
    "name": "كراس رسم وسط",
    "category": "أدوات ومستلزمات عامة",
    "price": 10,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 242,
    "name": "كراسة رسم صغيرة عادية",
    "category": "كشاكيل ودفاتر",
    "price": 5,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 243,
    "name": "كراسة رسم صغيرة نضيفة",
    "category": "كشاكيل ودفاتر",
    "price": 10,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 244,
    "name": "كراسة رسم بياني صغيرة",
    "category": "كشاكيل ودفاتر",
    "price": 7,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 245,
    "name": "كراسة رسم بياني كبيرة",
    "category": "كشاكيل ودفاتر",
    "price": 25,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 246,
    "name": "كراسة تلوين صغيرة",
    "category": "كشاكيل ودفاتر",
    "price": 8,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 247,
    "name": "كراسة تلوين تعليمي كبيرة",
    "category": "كشاكيل ودفاتر",
    "price": 12,
    "stock_count": 999,
    "image": "/products/coloring-set.jpg",
    "images": [
      "/products/coloring-set.jpg"
    ]
  },
  {
    "id": 248,
    "name": "قص ولزق صغير",
    "category": "لواصق ومثبتات",
    "price": 5,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 249,
    "name": "قص ولزق وسط",
    "category": "لواصق ومثبتات",
    "price": 8,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 250,
    "name": "قص ولزق كبير",
    "category": "لواصق ومثبتات",
    "price": 14,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 251,
    "name": "كشكول عربي 60ورقة",
    "category": "كشاكيل ودفاتر",
    "price": 8,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 252,
    "name": "كشكول انجليزي 60ورقة",
    "category": "كشاكيل ودفاتر",
    "price": 8,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 253,
    "name": "كشكول 9سطر 60ورقة",
    "category": "كشاكيل ودفاتر",
    "price": 8,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 254,
    "name": "كشكول مربعات 60ورقة",
    "category": "كشاكيل ودفاتر",
    "price": 8,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 255,
    "name": "كشكول عربي 100ورقة",
    "category": "كشاكيل ودفاتر",
    "price": 13,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 256,
    "name": "كشكول انجليزي 80ورقة",
    "category": "كشاكيل ودفاتر",
    "price": 11,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 257,
    "name": "كراسة عربي 28ورقة",
    "category": "كشاكيل ودفاتر",
    "price": 5,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 258,
    "name": "كراسة انجليزي 28ورقة",
    "category": "كشاكيل ودفاتر",
    "price": 5,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 259,
    "name": "كراسة 9سطر 28ورقة",
    "category": "كشاكيل ودفاتر",
    "price": 5,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 260,
    "name": "كراسة مربعات 28ورقة",
    "category": "كشاكيل ودفاتر",
    "price": 5,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 261,
    "name": "كراسة عربي 28ورقة منترا",
    "category": "كشاكيل ودفاتر",
    "price": 7,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 262,
    "name": "كراسة انجليزي 28ورقة منترا",
    "category": "كشاكيل ودفاتر",
    "price": 7,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 263,
    "name": "كراسة مربعات 28ورقة منترا",
    "category": "كشاكيل ودفاتر",
    "price": 7,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 264,
    "name": "كشكول عربي 40ورقة منترا",
    "category": "كشاكيل ودفاتر",
    "price": 10,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 265,
    "name": "كشكول عربي 60ورقة منترا",
    "category": "كشاكيل ودفاتر",
    "price": 13,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 266,
    "name": "كشكول انجليزي 60ورقة منترا",
    "category": "كشاكيل ودفاتر",
    "price": 13,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 267,
    "name": "كراسة انجليزي 28ورقة روكس",
    "category": "كشاكيل ودفاتر",
    "price": 6,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 268,
    "name": "كشكول عربي 60ورقة A5 سلك",
    "category": "كشاكيل ودفاتر",
    "price": 15,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 269,
    "name": "كشكول عربي 80ورقة A5 سلك امازون",
    "category": "كشاكيل ودفاتر",
    "price": 25,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 270,
    "name": "كشكول عربي 100ورقة A5 سلك امازون",
    "category": "كشاكيل ودفاتر",
    "price": 27,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 271,
    "name": "كشكول عربي 60ورقة A4 سلك امازون",
    "category": "كشاكيل ودفاتر",
    "price": 27,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 272,
    "name": "كشكول عربي 80ورقة A4 سلك امازون",
    "category": "كشاكيل ودفاتر",
    "price": 33,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 273,
    "name": "كشكول عربي 100ورقة A4 سلك امازون",
    "category": "كشاكيل ودفاتر",
    "price": 37,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 274,
    "name": "كشكول عربي 60ورقة A5 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 15,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 275,
    "name": "كشكول عربي 80ورقة A5 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 18,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 276,
    "name": "كشكول عربي 100ورقة A5 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 21,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 277,
    "name": "كشكول انجليزي 60ورقة A5 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 15,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 278,
    "name": "كشكول انجليزي 80ورقة A5 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 18,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 279,
    "name": "كشكول انجليزي 100ورقة A5 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 21,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 280,
    "name": "كشكول عربي 60ورقة A4 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 25,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 281,
    "name": "كشكول انجليزي 60ورقة A4 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 25,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 282,
    "name": "كشكول عربي 80ورقة A4 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 32,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 283,
    "name": "كشكول انجليزي 80ورقة A4 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 32,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 284,
    "name": "كشكول عربي 100ورقة A4 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 40,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 285,
    "name": "كشكول انجليزي 100ورقة A4 استارت ايجبت",
    "category": "كشاكيل ودفاتر",
    "price": 40,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 286,
    "name": "كشكول انجليزي 60ورقة A4 سلك",
    "category": "كشاكيل ودفاتر",
    "price": 26,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 287,
    "name": "كشكول انجليزي 80ورقة A4 سلك",
    "category": "كشاكيل ودفاتر",
    "price": 30,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 288,
    "name": "كشكول انجليزي 100ورقة A4 سلك",
    "category": "كشاكيل ودفاتر",
    "price": 34,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 289,
    "name": "فايل شفاف حرف U",
    "category": "ملفات وحوافظ",
    "price": 1,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 290,
    "name": "فايل شفاف حرف U تقيل",
    "category": "ملفات وحوافظ",
    "price": 2,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 291,
    "name": "فايل حكومي كرتون",
    "category": "ملفات وحوافظ",
    "price": 4,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 292,
    "name": "فايل حرف L",
    "category": "ملفات وحوافظ",
    "price": 7,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 293,
    "name": "دوسة كبسولة",
    "category": "ملفات وحوافظ",
    "price": 6,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 294,
    "name": "دوسية مسطره",
    "category": "ملفات وحوافظ",
    "price": 6,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 295,
    "name": "دوسية مسطرة كبير",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/geometry-set.jpg",
    "images": [
      "/products/geometry-set.jpg"
    ]
  },
  {
    "id": 296,
    "name": "دوسية كبسولة تقيل - شفاف",
    "category": "ملفات وحوافظ",
    "price": 7,
    "stock_count": 999,
    "image": "/products/zipper-folder.jpg",
    "images": [
      "/products/zipper-folder.jpg"
    ]
  },
  {
    "id": 297,
    "name": "جافظة ورق متخرم من الجمب",
    "category": "أدوات كتابة ورسم",
    "price": 6,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 298,
    "name": "قلم رصاص Prima نوع Neon-HB-2B",
    "category": "أدوات كتابة ورسم",
    "price": 4,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 299,
    "name": "قلم رصاص Black Peps",
    "category": "أدوات كتابة ورسم",
    "price": 4,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 300,
    "name": "قلم رصاص Nataraj",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 301,
    "name": "قلم رصاص deli منغير استيكة",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 302,
    "name": "قلم رصاص Deli نوع Bumpees-2B",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 303,
    "name": "قلم رصاص Doms super dark",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 304,
    "name": "قلم رصاص Faber Castell منغير استيكة",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 305,
    "name": "قلم رصاص Faber Castell",
    "category": "أدوات كتابة ورسم",
    "price": 8,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 306,
    "name": "قلم رصص عليه استيكة شكل",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 307,
    "name": "مناديل جيب",
    "category": "أدوات ومستلزمات عامة",
    "price": 3,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 308,
    "name": "قلم جاف فرنساوي ازرق-احمر-اسود-اخضر",
    "category": "أدوات كتابة ورسم",
    "price": 4,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 309,
    "name": "قلم جاف روتو Butterball ازرق-اخضر",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 310,
    "name": "قلم جاف روتو Liquidball ازرق-احمر-اسود",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 311,
    "name": "قلم جاف روتو Easy Flow ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 312,
    "name": "قلم جاف روتو Green planet ازرق-احمر-اسود",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 313,
    "name": "قلم جاف Bravo ازرق-احمر",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 314,
    "name": "قلم جاف Nikan Matic ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 315,
    "name": "قلم جاف Nikan Astor ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 316,
    "name": "قلم جاف Prima 25 ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 317,
    "name": "قلم جاف Prima Forsa ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 318,
    "name": "قلم جاف Prima Genta ازرق-اسود",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 319,
    "name": "قلم جاف Prima Magro احمر",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 320,
    "name": "قلم جاف Zongze ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 321,
    "name": "قلم جاف Veer ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 322,
    "name": "قلم جاف Faber Castell ازرق-احمر-اسود-اخضر",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 323,
    "name": "قلم جاف Deli Arrow احمر",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 324,
    "name": "قلم جاف روتو Rapid Flow ازرق-احمر",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 325,
    "name": "قلم جاف Pensan 2305 ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 326,
    "name": "قلم جافPensan 2307 ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 327,
    "name": "قلم جاف Pensan TR-23 ازرق-احمر-اسود-اخضر",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 328,
    "name": "قلم جاف Pensan Triball ازرق-اسود-اخضر",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 329,
    "name": "قلم جاف POS ازرق-احمر-اسود",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 330,
    "name": "قلم جاف Pensan My-Tech ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 331,
    "name": "قلم جاف Prima Jet ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 332,
    "name": "قلم جاف Lovein Bol اسود",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 333,
    "name": "قلم جاف Doms Inxtra ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 334,
    "name": "قلم جاف Doms Inxity ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 335,
    "name": "قلم جاف Doms Inxity Plus ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 336,
    "name": "قلم جاف Doms Inxklik ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 337,
    "name": "قلم جاف Doms Inxon ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 10,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 338,
    "name": "قلم جاف Prima Dante ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 10,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 339,
    "name": "قلم جاف Claro Signature ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 340,
    "name": "قلم جاف Claro Ultima ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 341,
    "name": "قلم جاف Big Boss ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 10,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 342,
    "name": "قلم جاف Piano Correct ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 7,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 343,
    "name": "قلم جاف Nikan 5G ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 344,
    "name": "قلم جاف Prima Solo اخضر",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 345,
    "name": "قلم جاف Prima Bronza اسود-احمر-اخضر",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 346,
    "name": "قلم جاف Youmei ازرق",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 347,
    "name": "قلم جاف Gel Ink Pen",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/blue-pen.jpg",
    "images": [
      "/products/blue-pen.jpg"
    ]
  },
  {
    "id": 348,
    "name": "قلم رصاص جرافيت مابيخلصش",
    "category": "أدوات كتابة ورسم",
    "price": 10,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 349,
    "name": "قلم سنون 2مم",
    "category": "أدوات كتابة ورسم",
    "price": 6,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 350,
    "name": "سنون 2مم",
    "category": "أدوات كتابة ورسم",
    "price": 5,
    "stock_count": 999,
    "image": "/products/wooden-pencils.jpg",
    "images": [
      "/products/wooden-pencils.jpg"
    ]
  },
  {
    "id": 351,
    "name": "دبابيس دباسة صغيرة",
    "category": "لواصق ومثبتات",
    "price": 5,
    "stock_count": 999,
    "image": "/products/office-stapler.jpg",
    "images": [
      "/products/office-stapler.jpg"
    ]
  },
  {
    "id": 352,
    "name": "لزق Faber Castell",
    "category": "لواصق ومثبتات",
    "price": 60,
    "stock_count": 999,
    "image": "",
    "images": []
  },
  {
    "id": 353,
    "name": "كشكول عربي 160ورقة A4",
    "category": "كشاكيل ودفاتر",
    "price": 55,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 354,
    "name": "كشكول عربي 250ورقة A4 سلك",
    "category": "كشاكيل ودفاتر",
    "price": 85,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 355,
    "name": "كشكول عربي 120ورقة A4 سلك هارد كافر بركة",
    "category": "كشاكيل ودفاتر",
    "price": 70,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 356,
    "name": "كشكول عربي 140ورقة A4 سلك هارد كافر بركة",
    "category": "كشاكيل ودفاتر",
    "price": 75,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 357,
    "name": "كشكول عربي 168ورقة A4 سلك هارد كافر برافو",
    "category": "كشاكيل ودفاتر",
    "price": 120,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 358,
    "name": "كشكول عربي 40ورقة A4 امازون",
    "category": "كشاكيل ودفاتر",
    "price": 17,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 359,
    "name": "كشكول عربي 60ورقة A4 امازون",
    "category": "كشاكيل ودفاتر",
    "price": 23,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 360,
    "name": "كشكول عربي 80ورقة A4 امازون",
    "category": "كشاكيل ودفاتر",
    "price": 30,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  },
  {
    "id": 361,
    "name": "كشكول عربي 100ورقة A4 امازون",
    "category": "كشاكيل ودفاتر",
    "price": 34,
    "stock_count": 999,
    "image": "/products/spiral-notebook.jpg",
    "images": [
      "/products/spiral-notebook.jpg"
    ]
  }
];
