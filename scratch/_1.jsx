<div className="flex flex-col w-full">
{/*  Top Ambient Glow & Welcome Operations Banner  */}
<div className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-lg mb-space-lg shadow-xl">
<div className="absolute -top-24 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
<div className="absolute -bottom-20 right-1/4 w-72 h-72 bg-tertiary-container/10 rounded-full blur-3xl pointer-events-none"></div>
<div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<div className="flex flex-wrap items-center gap-space-xs">
<span className="inline-flex items-center gap-1.5 px-space-sm py-space-2xs rounded-full bg-primary/10 text-primary font-label-tag text-label-tag tracking-wider">
<span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            نظام آمن ومحمي أوفلاين
          </span>
<span className="inline-flex items-center gap-1.5 px-space-sm py-space-2xs rounded-full bg-surface-container-high text-on-surface-variant font-label-code text-label-code">
<span className="material-symbols-outlined text-sm text-tertiary">bolt</span>
            نسخة ERP v2.4 الذكية
          </span>
<span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-lg bg-surface-container text-on-surface-variant font-label-code text-label-code">
            LAN 192.168.1.120:8080
          </span>
</div>
<h1 className="font-headline-lg text-headline-lg text-on-surface mt-space-2xs">
          مرحباً بك يا مدير كوبي كات في مركز العمليات المتقدم 🖨️
        </h1>
<p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
          تم تحديث النظام بالكامل ليشمل حاسبة الملازم المتطورة، إدارة أوردرات الشفت، الماسح الضوئي الذكي (OCR)، واستوديو تعديل الـ PDF، ومولد شيتات المدارس لخدمة زبائن المطبعة بأقصى سرعة وكفاءة.
        </p>
</div>
{/*  Quick Header Action Buttons  */}
<div className="flex flex-wrap items-center gap-space-sm self-start lg:self-center">
<a className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-primary-container text-on-primary-container font-headline-sm text-headline-sm hover:bg-primary transition-all shadow-md" data-path="print-calculator" href="#">
<span className="material-symbols-outlined text-xl">calculate</span>
<span>حاسبة الملازم والطباعة</span>
</a>
<a className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container-highest text-primary font-headline-sm text-headline-sm hover:bg-surface-bright transition-all" data-path="shift-orders" href="#">
<span className="material-symbols-outlined text-xl">assignment_turned_in</span>
<span>مهام وأوردرات الشفت</span>
</a>
<a className="flex items-center gap-space-xs px-space-sm py-space-sm rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-body-sm text-body-sm transition-all" data-path="public-storefront" href="#">
<span className="material-symbols-outlined text-lg">visibility</span>
<span>معاينة متجر الزبائن</span>
</a>
</div>
</div>
</div>
{/*  KPI Operational Metrics Grid (4 Top Metric Cards)  */}
<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-lg">
{/*  Card 1: Active Orders  */}
<div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low shadow-md relative overflow-hidden">
<div className="flex items-center justify-between mb-space-sm">
<span className="font-body-sm text-body-sm text-on-surface-variant font-semibold">أوردرات اليوم النشطة</span>
<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-xl">receipt_long</span>
</div>
</div>
<div className="flex items-baseline gap-space-xs mb-space-xs">
<span className="font-display-hero text-display-hero text-on-surface font-extrabold tracking-tight">38</span>
<span className="font-label-code text-label-code text-primary">أوردر مسجل</span>
</div>
<div className="flex items-center justify-between pt-space-xs">
<span className="inline-flex items-center gap-1 font-label-tag text-label-tag text-on-surface-variant">
<span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
          6 جاري تنفيذها بالماكينات
        </span>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded bg-surface-container-high text-primary">نشط</span>
</div>
</div>
{/*  Card 2: Printed Sheets Total  */}
<div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low shadow-md relative overflow-hidden">
<div className="flex items-center justify-between mb-space-sm">
<span className="font-body-sm text-body-sm text-on-surface-variant font-semibold">إجمالي النسخ المطبوعة اليوم</span>
<div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-xl">print</span>
</div>
</div>
<div className="flex items-baseline gap-space-xs mb-space-xs">
<span className="font-display-hero text-display-hero text-on-surface font-extrabold tracking-tight">14,850</span>
<span className="font-label-code text-label-code text-secondary">ورقة A4/A5</span>
</div>
<div className="flex items-center justify-between pt-space-xs">
<span className="inline-flex items-center gap-1 font-label-tag text-label-tag text-secondary">
<span className="material-symbols-outlined text-sm">trending_up</span>
          +18.4% مقارنة بالأمس
        </span>
<span className="font-label-code text-label-code text-on-surface-variant">شفت النهار</span>
</div>
</div>
{/*  Card 3: Shift Revenue  */}
<div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low shadow-md relative overflow-hidden">
<div className="flex items-center justify-between mb-space-sm">
<span className="font-body-sm text-body-sm text-on-surface-variant font-semibold">دخل الوردية الحالية</span>
<div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary">
<span className="material-symbols-outlined text-xl">point_of_sale</span>
</div>
</div>
<div className="flex items-baseline gap-space-xs mb-space-xs">
<span className="font-display-hero text-display-hero text-tertiary font-extrabold tracking-tight">4,280</span>
<span className="font-headline-sm text-headline-sm text-on-surface">ج.م</span>
</div>
<div className="flex items-center justify-between pt-space-xs">
<span className="font-label-tag text-label-tag text-on-surface-variant">نقدي: 3,450 | محفظة: 830</span>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded bg-surface-container-high text-tertiary">درج الكاش</span>
</div>
</div>
{/*  Card 4: Hardware & CMYK Health  */}
<div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low shadow-md relative overflow-hidden">
<div className="flex items-center justify-between mb-space-sm">
<span className="font-body-sm text-body-sm text-on-surface-variant font-semibold">كفاءة الماكينات وخراطيش الحبر</span>
<div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-xl">hub</span>
</div>
</div>
<div className="flex items-baseline gap-space-xs mb-space-xs">
<span className="font-display-hero text-display-hero text-on-surface font-extrabold tracking-tight">98.2%</span>
<span className="font-label-code text-label-code text-primary">جاهزية 100%</span>
</div>
{/*  CMYK Mini Tank Gauges  */}
<div className="flex flex-col gap-1 pt-space-xs">
<div className="grid grid-cols-4 gap-1">
<div className="h-1.5 rounded-full bg-primary" title="Cyan 84%"></div>
<div className="h-1.5 rounded-full bg-secondary-container" title="Magenta 76%"></div>
<div className="h-1.5 rounded-full bg-tertiary" title="Yellow 92%"></div>
<div className="h-1.5 rounded-full bg-surface-bright" title="Black/Key 88%"></div>
</div>
<span className="font-label-code text-label-code text-on-surface-variant text-[10px]">4 طابعات ليزر وريزو متصلة بالشبكة</span>
</div>
</div>
</div>
{/*  Header for Workstations Section  */}
<div className="flex items-center justify-between mb-space-md">
<div className="flex items-center gap-space-xs">
<span className="material-symbols-outlined text-primary text-2xl">grid_view</span>
<h2 className="font-headline-md text-headline-md text-on-surface">جميع أدوات وماكينات العمل اليومية</h2>
<span className="font-label-tag text-label-tag px-space-xs py-space-2xs rounded-lg bg-surface-container text-on-surface-variant">12 أداة جاهزة للتشغيل الفوري</span>
</div>
<div className="hidden sm:flex items-center gap-space-xs text-on-surface-variant font-label-code text-label-code">
<span className="w-2 h-2 rounded-full bg-primary"></span>
      وضع الإنتاج الفائق نشط
    </div>
</div>
{/*  The 12 Smart Machinery & Workstation Cards Grid  */}
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md mb-space-xl">
{/*  Tool 1: Smart Print & Booklets Calculator  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="print-calculator" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
<span className="material-symbols-outlined text-2xl">calculate</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-primary">حساب وش وظهر دقيق</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors mb-space-xs">
          حاسبة المطبعة والملازم الذكية
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          حساب دقيق لورق الملازم (وش وضهر)، أزرار تسعير الورقة، وإضافات التجليد والسلوفان مع حاسبة عامة سريعة بنظام Numpad.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-primary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">تسعير مخصص للمكتبة</span>
</div>
</a>
{/*  Tool 2: Shift Printing & Delivery Orders  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="shift-orders" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors">
<span className="material-symbols-outlined text-2xl">task_alt</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-on-surface">مراسلة واتساب فورية</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors mb-space-xs">
          أوردرات الطباعة وتسليم الشفت
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          متابعة أوردرات وملازم المدرسين، عداد النسخ المطبوعة الحي، مراسلة واتساب فورية، وتوليد تقرير تسليم الشفت بضغطة واحدة.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-primary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">تقرير شفت متكامل</span>
</div>
</a>
{/*  Tool 3: Advanced PDF Studio  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="advanced-pdf-studio" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary group-hover:bg-secondary-container group-hover:text-on-secondary-container transition-colors">
<span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-secondary">تعديل PDF أوفلاين</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-secondary transition-colors mb-space-xs">
          استوديو وأدوات الـ PDF المتقدمة
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          حذف صفحات الملازم من المنتصف والأطراف، تجميع الصور في ملف PDF، وتحويل المستندات العربية إلى Word بمسافات ضيقة وخط 18pt.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-secondary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">حذف صفحات &amp; صور لـ PDF</span>
</div>
</a>
{/*  Tool 4: Multi-Stage Smart OCR  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="smart-ocr-hub" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary group-hover:bg-tertiary group-hover:text-on-tertiary transition-colors">
<span className="material-symbols-outlined text-2xl">psychology</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-tertiary">تدقيق لغوي ذكي</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-tertiary transition-colors mb-space-xs">
          الماسح الضوئي الذكي (Multi-Stage OCR)
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          استخراج نصوص الأوراق والملازم على مرحلتين: استخراج بصري يتبعه تدقيق لغوي ونحوي عربي مع تصدير Word جاهز للطباعة.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-tertiary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">تصدير Word بخط 18pt</span>
</div>
</a>
{/*  Tool 5: School Vocabulary Generator  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="vocabulary-sheet-generator" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
<span className="material-symbols-outlined text-2xl">school</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-primary">خلط عشوائي للمفردات</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors mb-space-xs">
          مولد شيتات المفردات المدرسية
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          استخراج معاني الكلمات من كتب المدرسين، عداد النسخ، وتوليد نموذجين امتحانيين (نموذج أ / نموذج ب) بترتيب عشوائي وتصدير Word فوري.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-primary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">نموذج أ + نموذج ب</span>
</div>
</a>
{/*  Tool 6: LAN Rapid Transfer Hub  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="lan-transfer-hub" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface group-hover:bg-surface-bright transition-colors">
<span className="material-symbols-outlined text-2xl">share</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-on-surface-variant">0 استهلاك نت</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors mb-space-xs">
          مركز النقل السريع الداخلي (LAN Transfer)
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          نقل فوري للملفات والملازم الكبيرة بين أجهزة المكتبة عبر كابل الشبكة المحلية أو الراوتر بدون استهلاك باقة الإنترنت وبسرعات خيالية.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-primary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">سرعة كابل الشبكة القصوى</span>
</div>
</a>
{/*  Tool 7: National ID & Document Factory A5  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="national-id-builder" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
<span className="material-symbols-outlined text-2xl">badge</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-primary">تصدير Word A5</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors mb-space-xs">
          مصنع البطاقات والمستندات (A5)
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          قص وتجهيز بطاقات الرقم القومي، رخص القيادة، وشهادات الميلاد وش وظهر على ورقة A5 فورية مع معاينة حية ومحاذاة قياسية للطباعة.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-primary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">معيار رسمي 100%</span>
</div>
</a>
{/*  Tool 8: 4x6 Portrait Studio  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="portrait-studio" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
<span className="material-symbols-outlined text-2xl">photo_camera</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-on-surface-variant">AI بدون سيرفر</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors mb-space-xs">
          استوديو الصور الشخصية (4x6)
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          عزل الخلفية تلقائياً، تبييض وترميم ملامح الوجه، وضبط البدلات والملابس الرسمية مع رص 8 صور بجودة عالية جاهزة للطابعة الملونة.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-primary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">رص 8 صور 4x6</span>
</div>
</a>
{/*  Tool 9: Ink Saver & Document Whitener Scanner  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="ink-saver-scanner" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors">
<span className="material-symbols-outlined text-2xl">invert_colors</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-primary">توفير 70% حبر</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors mb-space-xs">
          ماسح المستندات وتوفير الحبر
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          قلب ألوان لقطات الشاشة الداكنة (Dark Mode Invert) وتبييض خلفية الورق الأصفر والظلال لتوفير الحبر الأسود مع نصوص عالية الحدة.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-primary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">تبييض فوري ونقي</span>
</div>
</a>
{/*  Tool 10: Academic Research Generator  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="academic-research-generator" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary group-hover:bg-tertiary group-hover:text-on-tertiary transition-colors">
<span className="material-symbols-outlined text-2xl">auto_stories</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-tertiary">أكاديمي معتمد</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-tertiary transition-colors mb-space-xs">
          مولد الأبحاث المدرسية والجامعية
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          صياغة وتنسيق الأبحاث A4 بهوامش ضيقة، فهارس ومراجع أكاديمية موثقة، غلاف رسمي للمدرسة أو الجامعة وتصدير Word جاهز فوراً.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-tertiary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">تنسيق Word A4 قياسي</span>
</div>
</a>
{/*  Tool 11: Daily Server Links & Government Portals  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="daily-server-links" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface group-hover:bg-surface-bright transition-colors">
<span className="material-symbols-outlined text-2xl">language</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-on-surface-variant">وصول سريع بضغطة زر</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors mb-space-xs">
          روابط وسيرفرات العمل اليومية
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          دليل الخدمات الحكومية، بوابات التنسيق والجامعات، منصات التقديم لوظائف المعلمين، ومواقع فحص وحساب التكلفة السريعة.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-primary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">24 بوابة حكومية</span>
</div>
</a>
{/*  Tool 12: Inventory & Materials Catalog  */}
<a className="group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md" data-path="inventory-catalog" href="#">
<div>
<div className="flex items-center justify-between mb-space-md">
<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
<span className="material-symbols-outlined text-2xl">inventory</span>
</div>
<span className="font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high text-primary">حصر 361 صنف</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors mb-space-xs">
          إدارة المخزن والكتالوج (حصر)
        </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          متابعة رصيد باكتات الورق 70g و 80g، خراطيش الحبر، السلك الحلزوني، وتحديث فوري لأسعار التوريد والبيع للزبائن.
        </p>
</div>
<div className="flex items-center justify-between pt-space-md mt-space-md">
<span className="font-label-code text-label-code text-primary flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
          تشغيل الأداة
          <span className="material-symbols-outlined text-base">arrow_forward</span>
</span>
<span className="font-label-tag text-label-tag text-on-surface-variant">تحديث الأسعار والموردين</span>
</div>
</a>
</div>
{/*  Recent Shift Activity & Active Print Queue Table  */}
<div className="rounded-xl bg-surface-container-low p-space-lg shadow-xl mb-space-lg">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-md">
<div className="flex items-center gap-space-xs">
<span className="material-symbols-outlined text-primary text-2xl">hourglass_top</span>
<div>
<h3 className="font-headline-sm text-headline-sm text-on-surface">أوردرات الشفت المباشرة وقائمة الانتظار</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">متابعة فورية للمهام قيد الطباعة والجاهزة للتسليم للزبائن والمدرسين</p>
</div>
</div>
<div className="flex items-center gap-space-xs">
<button className="flex items-center gap-1 px-space-sm py-space-xs rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm text-body-sm transition-colors" type="button">
<span className="material-symbols-outlined text-base">refresh</span>
<span>تحديث القائمة</span>
</button>
<a className="flex items-center gap-1 px-space-sm py-space-xs rounded-xl bg-primary-container text-on-primary-container font-body-sm text-body-sm hover:bg-primary transition-colors" data-path="shift-orders" href="#">
<span className="material-symbols-outlined text-base">add</span>
<span>أوردر جديد</span>
</a>
</div>
</div>
<div className="overflow-x-auto">
<table className="w-full text-right border-collapse">
<thead>
<tr className="bg-surface-container text-on-surface-variant font-label-code text-label-code">
<th className="p-space-sm rounded-r-xl">رقم الأوردر</th>
<th className="p-space-sm">اسم العميل / المدرس</th>
<th className="p-space-sm">تفاصيل المهمة</th>
<th className="p-space-sm text-left">الكمية</th>
<th className="p-space-sm text-left">الإجمالي</th>
<th className="p-space-sm text-center">الحالة</th>
<th className="p-space-sm text-center rounded-l-xl">إجراءات سريعة</th>
</tr>
</thead>
<tbody className="divide-y-0 text-on-surface font-body-sm text-body-sm">
{/*  Row 1  */}
<tr className="hover:bg-surface-container-high/40 transition-colors">
<td className="p-space-sm font-label-code text-label-code text-primary font-bold">#ORD-9421</td>
<td className="p-space-sm font-semibold">أ. محمود عبد العال (فيزياء)</td>
<td className="p-space-sm text-on-surface-variant">مذكرة ليلة الامتحان 1 ث - وش وظهر + غلاف كوشيه سلوفان</td>
<td className="p-space-sm text-left font-label-code text-label-code">80 ملزمة (48 ص)</td>
<td className="p-space-sm text-left font-label-code text-label-code text-tertiary font-bold">1,920 ج.م</td>
<td className="p-space-sm text-center">
<span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-primary/10 text-primary font-label-tag text-label-tag">
<span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                جاري الطباعة (ماكينة 1)
              </span>
</td>
<td className="p-space-sm text-center">
<div className="flex items-center justify-center gap-space-2xs">
<a className="p-space-xs rounded-lg bg-surface-container hover:bg-surface-bright text-primary transition-colors" href="https://wa.me/" target="_blank" title="مراسلة واتساب">
<span className="material-symbols-outlined text-base">chat</span>
</a>
<button className="p-space-xs rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface transition-colors" title="معاينة الفاتورة" type="button">
<span className="material-symbols-outlined text-base">description</span>
</button>
</div>
</td>
</tr>
{/*  Row 2  */}
<tr className="hover:bg-surface-container-high/40 transition-colors">
<td className="p-space-sm font-label-code text-label-code text-primary font-bold">#ORD-9420</td>
<td className="p-space-sm font-semibold">مدرسة النصر الإعدادية</td>
<td className="p-space-sm text-on-surface-variant">شهادات تقدير أوائل الطلبة A4 ورق مقوى 250g ألوان</td>
<td className="p-space-sm text-left font-label-code text-label-code">150 شهادة</td>
<td className="p-space-sm text-left font-label-code text-label-code text-tertiary font-bold">750 ج.م</td>
<td className="p-space-sm text-center">
<span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-surface-container-highest text-secondary font-label-tag text-label-tag">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                جاهز للتسليم
              </span>
</td>
<td className="p-space-sm text-center">
<div className="flex items-center justify-center gap-space-2xs">
<a className="p-space-xs rounded-lg bg-surface-container hover:bg-surface-bright text-primary transition-colors" href="https://wa.me/" target="_blank" title="إرسال إشعار جاهزية">
<span className="material-symbols-outlined text-base">send</span>
</a>
<button className="p-space-xs rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface transition-colors" title="تسليم الأوردر" type="button">
<span className="material-symbols-outlined text-base">check_circle</span>
</button>
</div>
</td>
</tr>
{/*  Row 3  */}
<tr className="hover:bg-surface-container-high/40 transition-colors">
<td className="p-space-sm font-label-code text-label-code text-primary font-bold">#ORD-9419</td>
<td className="p-space-sm font-semibold">عميل نقدي (مكتب توثيق)</td>
<td className="p-space-sm text-on-surface-variant">سحب سكانر وتجهيز بطاقات رقم قومي A5 وش وظهر</td>
<td className="p-space-sm text-left font-label-code text-label-code">12 بطاقة</td>
<td className="p-space-sm text-left font-label-code text-label-code text-tertiary font-bold">60 ج.م</td>
<td className="p-space-sm text-center">
<span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-surface-container-highest text-on-surface-variant font-label-tag text-label-tag">
                تم التسليم والكاش
              </span>
</td>
<td className="p-space-sm text-center">
<div className="flex items-center justify-center gap-space-2xs">
<button className="p-space-xs rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface transition-colors" title="إعادة طباعة إيصال" type="button">
<span className="material-symbols-outlined text-base">print</span>
</button>
</div>
</td>
</tr>
</tbody>
</table>
</div>
</div>
{/*  Bottom Quick Network Telemetry & Hardware Status Bar  */}
<div className="flex flex-col md:flex-row items-center justify-between p-space-sm rounded-xl bg-surface-container-low text-on-surface-variant font-label-code text-label-code gap-space-xs">
<div className="flex items-center gap-space-md flex-wrap">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
<span className="text-on-surface font-semibold">سيرفر المحطة:</span>
<span>Local Machine (Offline Engine)</span>
</div>
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-primary text-base">speed</span>
<span>زمن المعالجة البصرية OCR: 0.28 ثانية</span>
</div>
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-secondary text-base">folder_open</span>
<span>مجلد الإخراج: D:\CopyCat_Vault_2025</span>
</div>
</div>
<div className="flex items-center gap-space-xs">
<span className="px-space-xs py-space-2xs rounded bg-surface-container-high text-primary">Shift: النهار (أحمد المشرف)</span>
<span className="text-on-surface-variant">الفرع الرئيسي - ميت غمر</span>
</div>
</div>
</div>