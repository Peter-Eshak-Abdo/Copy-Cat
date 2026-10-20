import { NextRequest, NextResponse } from "next/server";
import { TOP_ARABIC_ACADEMIC_SOURCES, getDiverseSourcesForVersion } from "@/lib/docx/research-docx";

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 15;

export interface AcademicAngle {
  id: number;
  name: string;
  focus: string;
  keywords: string[];
}

export interface CustomSourceInput {
  name: string;
  category?: string;
  desc?: string;
  citation?: string;
}

export const ACADEMIC_ANGLES: AcademicAngle[] = [
  {
    id: 1,
    name: "المنظور التحليلي والتطبيقي الميداني",
    focus: "التركيز على النماذج التشغيلية، ومؤشرات قياس الأداء (KPIs)، ودراسات الحالة الميدانية في بيئة العمل الواقعية",
    keywords: ["التطبيق العملي", "الكفاءة التشغيلية", "النماذج الميدانية", "قياس الأداء"],
  },
  {
    id: 2,
    name: "المنظور التأصيلي والنظري والتاريخي",
    focus: "التركيز على الجذور الفكرية، وتطور المدارس والنظريات الكلاسيكية والحديثة، والتأصيل اللغوي والاصطلاحي",
    keywords: ["التأصيل التاريخي", "المدارس الفكرية", "التطور النظري", "المفاهيم التأسيسية"],
  },
  {
    id: 3,
    name: "المنظور التكنولوجي والاستشرافي والتحول الرقمي",
    focus: "التركيز على تطبيقات الذكاء الاصطناعي، وتحليلات البيانات الضخمة، والأتمتة السحابية والابتكار التقني",
    keywords: ["الذكاء الاصطناعي", "التحول الرقمي", "الأتمتة", "استشراف المستقبل"],
  },
  {
    id: 4,
    name: "منظور الحوكمة والسياسات والأطر التنظيمية",
    focus: "التركيز على اللوائح التشريعية، ومعايير الشفافية والمساءلة، وإدارة المخاطر، والالتزام المؤسسي",
    keywords: ["الحوكمة الرشيدة", "الأطر التشريعية", "إدارة المخاطر", "السياسات التنظيمية"],
  },
  {
    id: 5,
    name: "المنظور المقارن والدراسات البينية الدولية",
    focus: "التركيز على مقارنة التجارب المحلية والعربية بنظيراتها العالمية واستخلاص أفضل الممارسات المعتمدة",
    keywords: ["الدراسات المقارنة", "التجارب الدولية", "نقل المعرفة", "المعايير العالمية"],
  },
  {
    id: 6,
    name: "المنظور الاقتصادي ودراسات الجدوى والاستدامة المالية",
    focus: "التركيز على تحليل التكلفة والعائد، وإدارة الموارد الاقتصادية، واستدامة الاستثمار والنمو المالي",
    keywords: ["الجدوى الاقتصادية", "تحليل التكلفة", "تعظيم العائد", "الاستدامة المالية"],
  },
  {
    id: 7,
    name: "المنظور السوسيولوجي والأبعاد المجتمعية والسلوكية",
    focus: "التركيز على الأثر المجتمعي، والثقافة التنظيمية، وإدارة التغيير البشري والرضا العام",
    keywords: ["الأثر المجتمعي", "السلوك المؤسسي", "الثقافة التنظيمية", "إدارة التغيير"],
  },
  {
    id: 8,
    name: "المنظور الاستراتيجي والقيادي وصناعة القرار",
    focus: "التركيز على القيادة التحويلية، والتخطيط بعيد المدى، وتحديد الميزات التنافسية وبناء السيناريوهات",
    keywords: ["القيادة الاستراتيجية", "صناعة القرار", "الميزة التنافسية", "الرؤى المستقبلية"],
  },
  {
    id: 9,
    name: "منظور الجودة الشاملة والاعتماد المؤسسي (ISO)",
    focus: "التركيز على معايير الجودة الشاملة، وبطاقات التقييم، وتدقيق العمليات والتحسين المستمر كايزن",
    keywords: ["إدارة الجودة الشاملة", "الاعتماد الأكاديمي", "معايير الآيزو", "التحسين المستمر"],
  },
  {
    id: 10,
    name: "المنظور المعرفي والبحث والتطوير (R&D)",
    focus: "التركيز على إدارة المعرفة، وإنتاج الأصول الفكرية، وحاضنات الابتكار ودور الجامعات البحثية",
    keywords: ["إدارة المعرفة", "البحث والتطوير", "حاضنات الابتكار", "الملكية الفكرية"],
  },
  {
    id: 11,
    name: "منظور التنمية المستدامة والمسؤولية البيئية (ESG)",
    focus: "التركيز على أهداف التنمية المستدامة للأمم المتحدة، والمسؤولية المجتمعية والمبادرات الخضراء",
    keywords: ["التنمية المستدامة", "المعايير البيئية", "رؤية 2030", "المسؤولية الاجتماعية"],
  },
  {
    id: 12,
    name: "المنظور الإجرائي واللوجستي وهندسة العمليات",
    focus: "التركيز على سلاسل الإمداد، وتدفق الإجراءات، وتبسيط دورة العمل وإلغاء الهدر الإداري",
    keywords: ["سلاسل الإمداد", "هندسة العمليات", "تبسيط الإجراءات", "الكفاءة اللوجستية"],
  },
  {
    id: 13,
    name: "المنظور الاتصالي والإعلامي وبناء الصورة الذهنية",
    focus: "التركيز على قنوات الاتصال الاستراتيجي، والتسويق المعرفي، وبناء السمعة المؤسسية الموثوقة",
    keywords: ["الاتصال المؤسسي", "الصورة الذهنية", "التسويق المعرفي", "إشراك المستفيدين"],
  },
  {
    id: 14,
    name: "المنظور التربوي وتأهيل رأس المال البشري",
    focus: "التركيز على التعليم المستمر، وصقل المهارات الرقمية والمهنية، وإعداد جيل الكفاءات الجديد",
    keywords: ["رأس المال البشري", "صقل المهارات", "التأهيل الأكاديمي", "التطوير المهني"],
  },
  {
    id: 15,
    name: "المنظور النقدي والاستدراكي وحل المشكلات الإبداعي",
    focus: "التركيز على تشخيص الثغرات والقصور في الممارسات الحالية وطرح بدائل وحلول إبداعية خارج الصندوق",
    keywords: ["التحليل النقدي", "معالجة الفجوات", "الحلول الإبداعية", "التفكير التصميمي"],
  },
];

/**
 * High-fidelity academic research synthesizer (Wikipedia / Encyclopedic Architecture)
 * Generates rich, realistic encyclopedic chapters scaling to any page count (including 30-60 pages)
 * with dynamic and randomized heading structures without cliché boilerplate stamps.
 */
function generateAcademicFallback(
  topic: string,
  pages: number,
  includeIntro: boolean,
  includeConclusion: boolean,
  includeRefs: boolean,
  angle?: AcademicAngle,
  customSources?: CustomSourceInput[],
  versionIndex: number = 0
): string {
  const t = topic.trim();
  const currentAngle = angle || ACADEMIC_ANGLES[versionIndex % ACADEMIC_ANGLES.length];
  const paragraphs: string[] = [];

  // Main encyclopedic research title
  paragraphs.push(`دراسة موسوعية وبحث أكاديمي بعنوان: ${t} (${currentAngle.name})\n`);

  // 1. Diverse Introduction Architectures (5 distinct models based on versionIndex)
  if (includeIntro) {
    const introStyleIndex = versionIndex % 5;
    if (introStyleIndex === 0) {
      paragraphs.push(`مقدمة وتمهيد تحليلي وإشكالية الدراسة:`);
      paragraphs.push(
        `تكتسب معالجة موضوع "${t}" أهمية منهجية متصاعدة في ظل المتغيرات المعرفية المتسارعة؛ إذ لا يقتصر أثره على الجوانب النظرية المجردة، بل يمتد ليشكل ركيزة حيوية في فهم الآليات التشغيلية وتحليل المشكلات الواقعية المعقدة. وتنطلق هذه النسخة خصيصاً من (${currentAngle.name})، مركزةً على: ${currentAngle.focus}.`
      );
      paragraphs.push(
        `وتتمحور إشكالية هذا البحث حول رصد التباين بين المفاهيم التأسيسية والممارسات التطبيقية الفعلية لـ "${t}"، مع دراسة دور (${currentAngle.keywords.join(" و ")}) في تذليل العقبات القائمة، واستشراف مسارات التطوير المستقبلي وفق معايير الجودة والاعتماد الأكاديمي الرصين.`
      );
      paragraphs.push(
        `ويهدف هذا العمل إلى تقديم قراءة استقصائية مدعومة بالبيانات والأدلة المستقاة من أحدث الأطروحات الجامعية والدوريات المصنفة، بما يرفد المكتبة العربية بمرجع أكاديمي رصين يجمع بين التأصيل النظري والاستدلال بالنماذج الميدانية المحكمة.`
      );
    } else if (introStyleIndex === 1) {
      paragraphs.push(`المقدمة والتأصيل المعرفي والمؤسسي:`);
      paragraphs.push(
        `شهد الفكر الأكاديمي المعاصر اهتماماً بالغاً ببحث مقومات وأبعاد "${t}"، بوصفه أحد المفاهيم المحورية التي أعادت تشكيل الرؤى العلمية والممارسات المؤسسية. وتأتي هذه النسخة لتسليط الضوء على هذا المحور من منظور (${currentAngle.name})؛ حيث ينصب التحليل والتقصي على: ${currentAngle.focus}.`
      );
      paragraphs.push(
        `وتنبع مشكلة البحث من تزايد الحاجة إلى تأصيل علمي رصين يوضح كيفية توظيف (${currentAngle.keywords[0] || "المفاهيم التأسيسية"}) و(${currentAngle.keywords[1] || "الأطر المنهجية"}) في بناء نماذج مؤسسية متطورة قادرة على مواكبة تحديات العصر والتنافسية المعرفية.`
      );
      paragraphs.push(
        `وتسعى الدراسة إلى استجلاء المفاهيم المركزية، وتحليل أثرها في البيئة التطبيقية، وطرح استراتيجيات تنفيذية تدعم مسارات اتخاذ القرار وتعزز كفاءة الأداء الشامل.`
      );
    } else if (introStyleIndex === 2) {
      paragraphs.push(`مقدمة استشرافية وأبعاد التحول المعاصر:`);
      paragraphs.push(
        `في عصر التحول الرقمي وتدفق البيانات الضخمة، يبرز موضوع "${t}" كأحد أبرز مجالات الاهتمام الاستراتيجي التي تتقاطع فيها الرؤى العلمية مع الابتكارات التطبيقية. وتتأطر هذه المعالجة العلمية من خلال (${currentAngle.name})، مستهدفةً استكشاف: ${currentAngle.focus}.`
      );
      paragraphs.push(
        `وتتحدد القضية الجوهرية للبحث في الإجابة عن التساؤل حول مدى قدرة الممارسات الحالية لـ "${t}" على استيعاب معطيات (${currentAngle.keywords.join("، ")})، وتحويل التحديات الميدانية إلى فرص للريادة والتميز المستدام.`
      );
      paragraphs.push(
        `ويرمي هذا البحث إلى رسم ملامح خارطة طريق واضحة المعالم، تسهم في سد الفجوات القائمة بين متطلبات التطوير وواقع الممارسة، مع الاستناد إلى مؤشرات كمية ودراسات استقرائية موثوقة.`
      );
    } else if (introStyleIndex === 3) {
      paragraphs.push(`توطئة وتمهيد مقارن وأهداف البحث الميداني:`);
      paragraphs.push(
        `تفرض التطورات المتلاحقة في الميادين الأكاديمية والمهنية إعادة النظر في الأطر الحاكمة لموضوع "${t}"، بغية تقييم فاعليتها واستخلاص الدروس المستفادة من التجارب الرائدة. ويختص هذا البحث بالمعالجة من منظور (${currentAngle.name})، بالتركيز المباشر على: ${currentAngle.focus}.`
      );
      paragraphs.push(
        `وتتبلور معضلة الدراسة في بحث الفجوة بين الأطر المعيارية والنتائج الميدانية المتحققة لـ "${t}"، مع دراسة تأثير (${currentAngle.keywords.slice(0, 3).join(" و ")}) في تحقيق التوافق بين الأهداف المرسومة ومؤشرات الإنجاز الواقعية.`
      );
      paragraphs.push(
        `ويتوخى البحث بناء رؤية متكاملة تجمع بين أصالة التنظير وعمق التحليل المقارن، وتقديم توصيات قابلة للقياس تعود بالنفع على المهتمين بهذا الحقل الحيوي.`
      );
    } else {
      paragraphs.push(`مقدمة البحث والإطار الاستراتيجي للحوكمة والتنمية:`);
      paragraphs.push(
        `يحتل موضوع "${t}" مكانة متقدمة في سلم أولويات الدراسات الحديثة، نظراً لارتباطه الوثيق بأولويات التنمية ومتطلبات الحوكمة والريادة المؤسسية. وتتبنى هذه النسخة مدخلاً نوعياً يتمثل في (${currentAngle.name})؛ سبيلاً إلى فحص وتدقيق: ${currentAngle.focus}.`
      );
      paragraphs.push(
        `وتتلخص إشكالية البحث في كيفية صياغة سياسات واضحة وآليات عمل منهجية تضمن الاستفادة القصوى من إمكانات "${t}" وتطبيق مبادئ (${currentAngle.keywords.join("، ")}) بكفاءة واقتدار.`
      );
      paragraphs.push(
        `ويهدف البحث إلى صياغة نموذج تحليلي شامل يُسهم في تعزيز البنية المعرفية، ودعم صناع السياسات والمختصين بأدوات وحلول مبتكرة وموثقة أكاديمياً.`
      );
    }
  }

  if (pages <= 5) {
    // 1-5 Pages: 5 Core Encyclopedic Sections
    paragraphs.push(`نظرة عامة والمدخل المفاهيمي لـ (${t}):`);
    paragraphs.push(
      `يُعرّف "${t}" في الأدبيات العلمية والمعاجم التخصصية بأنه نسق متكامل يربط بين الأطر الفكرية والنماذج التطبيقية. وقد تطور هذا المفهوم تدريجياً استجابة لمتطلبات العصر واحتياجات المؤسسات، خاصة فيما يتصل بـ ${currentAngle.focus}.`
    );
    paragraphs.push(
      `وتشير الدراسات التوثيقية إلى أن الفهم الدقيق لـ "${t}" يقتضي استيعاب مقوماته الأساسية وموقعه ضمن منظومة المعرفة الإنسانية والتطبيقية المعاصرة ودور (${currentAngle.keywords.join(" و ")}).`
    );

    paragraphs.push(`النشأة التاريخية ومراحل التطور والتحول:`);
    paragraphs.push(
      `شهدت مسيرة "${t}" محطات فارقة؛ حيث انطلقت من بدايات تأسيسية تبلورت عبر إسهامات نخبة من الرواد والمؤسسات، وصولاً إلى مرحلة التأطير الأكاديمي، ثم القفزة المعرفية والتكنولوجية المعاصرة التي أعادت صياغة الأولويات وفتحت آفاقاً واسعة للابتكار.`
    );

    paragraphs.push(`المقومات الجوهرية والآليات التشغيلية:`);
    paragraphs.push(
      `تقوم بنية "${t}" على حزمة من الركائز المتكاملة تشمل: الكفاءات البشرية، السياسات والإجراءات الواضحة، البنية الداعمة، ومعايير الجودة والحوكمة. ويعتمد الأداء الفعال على التناغم بين هذه المكونات لضمان تحقيق أعلى معدلات الكفاءة والاستدامة.`
    );

    paragraphs.push(`النماذج التطبيقية والتجارب الميدانية الواقعية:`);
    paragraphs.push(
      `تسلط دراسات الحالة الموثقة في بنك المعرفة وقواعد البيانات العربية الضوء على نماذج رائدة استثمرت مبادئ "${t}" بنجاح، مما أسهم في تحسين الإنتاجية، وترشيد الموارد، وابتكار حلول عملية لمعضلات معقدة في بيئات العمل المختلفة.`
    );

    paragraphs.push(`التحديات الراهنة واستشراف المسارات المستقبلية:`);
    paragraphs.push(
      `على الرغم من المكتسبات، تواجه مسيرة "${t}" تحديات تتعلق بسرعة التحولات المعاصرة ومحدودية الموارد أحياناً. ومع ذلك، يفتح التطور المستمر آفاقاً غير مسبوقة لبناء نماذج مستقبلية أكثر مرونة واستجابة لمتطلبات الريادة والجودة الشاملة.`
    );
  } else {
    // 6-60 Pages: Comprehensive, In-Depth Encyclopedic Sections
    const encyclopedicHeadings = [
      `المدخل الموسوعي والإطار المفاهيمي لـ (${t})`,
      `الجذور والنشأة التاريخية وتطور الظاهرة عبر الحقب المختلفة`,
      `الأسس العلمية والمدارس الفكرية الرائدة في دراسة (${t})`,
      `العلاقات المعرفية والصلات البينية مع العلوم الحديثة`,
      `الركائز الهيكلية والمكونات التنظيمية والتشغيلية`,
      `الأطر التشريعية والسياسات العامة ومعايير الجودة المعتمدة`,
      `المؤشرات الإحصائية ومقاييس تقييم كفاءة الأداء (KPIs)`,
      `التطبيقات الميدانية ودراسات الحالة الواقعية في البيئة العربية`,
      `الأبعاد الاقتصادية والجدوى التنموية والاستثمارية لـ (${t})`,
      `الأثر المجتمعي والأبعاد السلوكية والثقافية المحيطة`,
      `المعوقات والتحديات التشغيلية والإدارية والمالية الراهنة`,
      `المقارنات الدولية وأفضل الممارسات العالمية المعيارية`,
      `الابتكار التكنولوجي وتطبيقات الذكاء الاصطناعي في مجالات (${t})`,
      `خارطة طريق تنفيذية مقترحة للتطوير المستدام والريادة`,
      `الرؤى الاستشرافية والسيناريوهات المستقبلية المتوقعة حتى 2030`,
    ];

    // Reorder headings for diverse copies
    const offset = versionIndex % encyclopedicHeadings.length;
    const reorderedHeadings = [
      encyclopedicHeadings[0],
      encyclopedicHeadings[1],
      ...encyclopedicHeadings.slice(2, -2).sort((a, b) => {
        const hashA = (a.length + offset * 7) % 10;
        const hashB = (b.length + offset * 7) % 10;
        return hashA - hashB;
      }),
      encyclopedicHeadings[encyclopedicHeadings.length - 2],
      encyclopedicHeadings[encyclopedicHeadings.length - 1],
    ];

    reorderedHeadings.forEach((heading, idx) => {
      paragraphs.push(`${idx + 1}. ${heading}:`);
      paragraphs.push(
        `تكتسب مباحث "${heading}" أهمية بالغة عند تناول موضوع "${t}" من زاوية (${currentAngle.name})؛ حيث ينعكس أثرها المباشر في تعميق الرؤية وتفكيك الإشكاليات المعقدة المرتبطة بـ ${currentAngle.focus}.`
      );
      paragraphs.push(
        `وتكشف القراءات التحليلية المعمقة المستندة إلى أحدث الدراسات والأطروحات الجامعية المحكمة عن تمايز التجارب الميدانية وتنوع مناهج المعالجة العلمية لهذا المحور، مما يؤكد الطبيعة الديناميكية المتجددة لـ "${t}".`
      );
      paragraphs.push(
        `ويبرز التحليل المقارن أن التوظيف المنهجي لمحددات (${currentAngle.keywords.join("، ")}) ضمن هذا السياق يسهم في سد الفجوات التنظيمية وبناء حلول ابتكارية مستدامة تضمن تحقيق أعلى عوائد ممكنة على الصعيدين النظري والتطبيقي.`
      );
      if (pages >= 15) {
        paragraphs.push(
          `وعلى صعيد النماذج العملية، يُظهر الرصد الميداني أن المؤسسات التي تبنت استراتيجيات مرنة قائمة على البيانات الدقيقة والمتابعة التقييمية المستمرة تمكنت من تجاوز العقبات التقليدية وتحقيق قفزات نوعية في مؤشرات التنافسية والجودة الشاملة.`
        );
      }
    });
  }

  // 2. Diverse Conclusion Architectures (5 distinct models based on versionIndex)
  if (includeConclusion) {
    const conclusionStyleIndex = versionIndex % 5;
    if (conclusionStyleIndex === 0) {
      paragraphs.push(`خاتمة واستنتاجات وتوصيات إجرائية وتنفيذية:`);
      paragraphs.push(
        `أفضت هذه الدراسة المتعمقة حول "${t}" من منظور (${currentAngle.name}) إلى حزمة من الاستنتاجات العلمية الجوهرية؛ وفي مقدمتها أن النجاح في تفعيل مقومات هذا الموضوع يرتبط ارتباطاً وثيقاً بدرجة الالتزام بـ (${currentAngle.keywords[0] || "المعايير المعتمدة"}) والقدرة على التكيف مع المتغيرات البيئية والمؤسسية.`
      );
      paragraphs.push(`وبناءً على ما تقدم من شواهد وتحليلات، يُوصي البحث بما يلي:`);
      paragraphs.push(
        `1. إرساء آليات دورية لتقييم الأداء في مجالات "${t}" بالاعتماد على مؤشرات قياس محددة وقابلة للتحقق ومتابعة تطبيق (${currentAngle.keywords[1] || "الآليات المقترحة"}).`
      );
      paragraphs.push(`2. دعم برامج التدريب والتأهيل المستمر للكوادر القائمة على تطبيق ومتابعة هذا النشاط لضمان جودة المخرجات.`);
      paragraphs.push(`3. تعزيز الشراكة بين المؤسسات البحثية والقطاعات التنفيذية لتبادل الخبرات وتطوير الممارسات الميدانية.`);
      paragraphs.push(`4. إنشاء قواعد بيانات معرفية متخصصة ترصد أفضل الممارسات وتوثق التطورات الحديثة المتعلقة بـ "${t}".`);
    } else if (conclusionStyleIndex === 1) {
      paragraphs.push(`خاتمة وخلاصة النتائج والتوجيهات المؤسسية:`);
      paragraphs.push(
        `تخلص هذه الدراسة في استقرائها لموضوع "${t}" إلى التأكيد على أن التأصيل النظري والمؤسسي يشكل صمام الأمان لنجاح أي مبادرة تطويرية تنطلق من (${currentAngle.name})، وأن التغاضي عن (${currentAngle.keywords[1] || "الأبعاد الهيكلية"}) غالباً ما يؤدي إلى تراجع العوائد المتوقعة.`
      );
      paragraphs.push(`وعليه، تضع هذه النسخة بين يدي المعنيين مجموعة من التوصيات الحيوية:`);
      paragraphs.push(`1. مراجعة وتحديث اللوائح والسياسات المنظمة لتتلاءم مع مستجدات "${t}" ومعايير الجودة المعتمدة.`);
      paragraphs.push(`2. ترسيخ ثقافة الشفافية والمساءلة وتوثيق الإجراءات التنظيمية في كافة مراحل العمل المؤسسي.`);
      paragraphs.push(`3. تبني استراتيجيات مرنة تشجع الابتكار وتفتح المجال للحلول غير التقليدية في معالجة القضايا الشائكة.`);
      paragraphs.push(`4. تشجيع الدراسات البينية التي تسبر أغوار "${t}" وتستثمر مخرجات العلوم المجاورة.`);
    } else if (conclusionStyleIndex === 2) {
      paragraphs.push(`خلاصة استشرافية ورؤية مستقبلية للمسار القادم:`);
      paragraphs.push(
        `أثبتت معطيات البحث والتحليل العلمي لـ "${t}" أن المستقبل مرهون بقدرة المؤسسات على دمج الابتكارات الذكية وتطبيقات التقنية المعاصرة ضمن منظومة العمل من منظور (${currentAngle.name})؛ حيث يمثل (${currentAngle.keywords[0] || "التحول التقني"}) رافعة أساسية للنمو والريادة.`
      );
      paragraphs.push(`وفي ضوء ذلك، يقترح البحث حزمة من التوصيات الاستشرافية:`);
      paragraphs.push(`1. تسريع وتيرة التحول الرقمي وأتمتة العمليات المرتبطة بـ "${t}" لتقليل الهدر ورفع الكفاءة التشغيلية.`);
      paragraphs.push(`2. الاستثمار في بنية تحتية متطورة تدعم تحليلات البيانات المتقدمة والأمن السيبراني.`);
      paragraphs.push(`3. وضع خطط استباقية وسيناريوهات طوارئ لإدارة المخاطر التقنية والمؤسسية المحتملة.`);
      paragraphs.push(`4. تمكين رأس المال البشري وتزويده بالمهارات الرقمية المتقدمة التي يتطلبها المستقبل.`);
    } else if (conclusionStyleIndex === 3) {
      paragraphs.push(`خاتمة واستخلاص للدروس المستفادة ونماذج النجاح:`);
      paragraphs.push(
        `تؤكد نتائج المقارنات والتحليلات الميدانية لـ "${t}" أن النجاح ليس قالباً جامداً، بل يتطلب مواءمة ذكية بين المعايير المعتمدة في (${currentAngle.name}) والخصوصيات البيئية والمجتمعية لكل سياق عمل.`
      );
      paragraphs.push(`وانطلاقاً من التجارب الناجحة التي تم رصدها، يوصى بالآتي:`);
      paragraphs.push(`1. استلهام التجارب الإقليمية والدولية الرائدة في مجال "${t}" مع تكييفها بما يناسب الاحتياجات والظروف المحلية.`);
      paragraphs.push(`2. تطوير بطاقات أداء متوازن تربط بين الأهداف الاستراتيجية ومؤشرات الإنجاز الميدانية بدقة.`);
      paragraphs.push(`3. تفعيل آليات التغذية الراجعة واستطلاع آراء المستفيدين لقياس مستوى الرضا وتحديد فرص التحسين المستمر.`);
      paragraphs.push(`4. تخصيص ميزانيات داعمة لمشاريع التطوير والبحث المستمر وبناء الشراكات المنتجة.`);
    } else {
      paragraphs.push(`الخاتمة والتوصيات الاستراتيجية للتنمية المستدامة:`);
      paragraphs.push(
        `تُبرهن محاور هذه الدراسة على أن الاستثمار في "${t}" يمثل استثماراً طويل الأجل في مقومات التنمية المستدامة، متى ما استند إلى مبادئ الحوكمة الرشيدة والرؤية الاستراتيجية الشاملة لـ (${currentAngle.name}).`
      );
      paragraphs.push(`وتوصي الدراسة بالخطوات العملية التالية:`);
      paragraphs.push(`1. إدماج أبعاد التنمية المستدامة والمسؤولية المجتمعية ضمن خطط وبرامج "${t}".`);
      paragraphs.push(`2. تطوير منظومة حوكمة رصينة تعزز النزاهة وتضمن كفاءة استغلال الموارد المتاحة.`);
      paragraphs.push(`3. تشكيل فرق عمل متخصصة لقيادة مبادرات التغيير وتجاوز معوقات التطوير.`);
      paragraphs.push(`4. عقد مؤتمرات وورش عمل دورية لنشر المعرفة وتعزيز الوعي بأهمية "${t}" ومخرجاته العلمية.`);
    }
  }

  // 3. Diverse References per version
  if (includeRefs) {
    paragraphs.push(`قائمة المصادر والمراجع الأكاديمية المعتمدة:`);
    const baseSources =
      customSources && customSources.length > 0
        ? customSources.map((s, idx) => ({
            id: `custom_${idx}`,
            name: s.name,
            desc: s.desc,
            category: s.category,
            citation: s.citation,
          }))
        : TOP_ARABIC_ACADEMIC_SOURCES;

    const activeSources = getDiverseSourcesForVersion(baseSources, versionIndex + 1, 8);
    activeSources.forEach((s, idx) => {
      let citationText = "";
      if ("getCitation" in s && typeof s.getCitation === "function") {
        citationText = s.getCitation(t);
      } else if ("citation" in s && s.citation) {
        citationText = `${idx + 1}. ${s.name} - ${s.citation}`;
      } else {
        citationText = `${idx + 1}. ${s.name}${s.category ? ` (${s.category})` : ""} - دراسات وبحوث متخصصة في (${t})، ${s.desc || "توثيق معتمد 2024"}.`;
      }
      paragraphs.push(citationText);
    });
  }

  return paragraphs.join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "anonymous";
    const now = Date.now();
    const clientLimit = rateLimitMap.get(ip);

    if (clientLimit && now < clientLimit.resetTime) {
      if (clientLimit.count >= MAX_REQUESTS_PER_MINUTE) {
        return NextResponse.json(
          { error: "تم تجاوز الحد الأقصى للطلبات مؤقتاً. يرجى الانتظار دقيقة قبل المحاولة مجدداً." },
          { status: 429 }
        );
      }
      clientLimit.count += 1;
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    }

    // 2. Parse & Validate Payload
    const body = await req.json().catch(() => ({}));
    const {
      topic,
      targetPages = 5,
      includeIntro = true,
      includeConclusion = true,
      includeRefs = true,
      customDetails = "",
      versionsCount = 1,
      customSources = [],
    } = body;

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return NextResponse.json({ error: "من فضلك أدخل عنوان البحث المطلوب" }, { status: 400 });
    }

    const sanitizedTopic = topic.trim().slice(0, 300);
    const numPages = Math.max(1, Math.min(60, Number(targetPages) || 5));
    const targetWords = numPages * 320;
    const count = Math.max(1, Math.min(15, Number(versionsCount) || 1));

    // Determine random starting angle offset so repeat queries on different days yield different angles
    const randomStartOffset = Math.floor(Math.random() * ACADEMIC_ANGLES.length);

    // Helper to build prompt for a specific academic angle with Wikipedia-style architecture
    const buildPromptForAngle = (angle: AcademicAngle, versionNum: number) => {
      const sectionCount = Math.max(5, Math.min(16, Math.round(numPages * 0.45) + 3));

      // Get diverse sources tailored specifically for this version
      const baseSources =
        Array.isArray(customSources) && customSources.length > 0
          ? customSources.map((s: CustomSourceInput, idx: number) => ({
              id: `custom_${idx}`,
              name: s.name,
              desc: s.desc,
              category: s.category,
              citation: s.citation,
            }))
          : TOP_ARABIC_ACADEMIC_SOURCES;

      const versionSources = getDiverseSourcesForVersion(baseSources, versionNum, 8);
      const versionSourcesText = versionSources
        .map((s, i) => `${i + 1}. ${s.name}${s.category ? ` (${s.category})` : ""}${s.desc ? ` - ${s.desc}` : ""}`)
        .join("\n");

      return `أنت أستاذ أكاديمي وباحث ومحرر موسوعي متخصص. اكتب بحثاً دراسياً وأكاديمياً وموسوعياً متميزاً ومفصلاً باللغة العربية الفصحى حول موضوع: (${sanitizedTopic}).

منظور التناول الأكاديمي لهذه النسخة المحددة (نسخة رقم ${versionNum}):
[${angle.name}]
المحور الجوهري: ${angle.focus}
الكلمات الدالة: ${angle.keywords.join("، ")}.

تعليمات حاسمة ومشددة لضمان عدم التطابق والتفرد الكامل للنسخة رقم (${versionNum}):
1. المقدمة والتمهيد: صِغ مقدمة متفردة وحصرية تماماً للنسخة رقم (${versionNum}) بأسلوب بلاغي مختلف وفكرة تمهيدية وإشكالية خاصة بزاوية [${angle.name}]، تختلف 100% في كلماتها ومصطلحاتها عن أي نسخة أخرى لنفس الموضوع.
2. الخاتمة والتوصيات: صِغ خاتمة استثنائية وخاصة بالنسخة رقم (${versionNum}) تحتوي على استنتاجات وتوصيات إجرائية وتنفيذية مبتكرة مستوحاة من زاوية التناول ولا تتطابق مع أي نسخة ثانية.
3. الترتيب والتنويع بين النسخ: اجعل هذه النسخة (رقم ${versionNum}) مختلفة تماماً في ترتيب المحاور، صياغة العناوين الفرعية، وزوايا النقاش والتحليل، بحيث إذا تم طلب عدة نسخ لنفس الموضوع تكون كل نسخة مستقلة ومتفردة بهيكلها ومحتواها.
4. قائمة المصادر والمراجع المعتمدة لهذه النسخة (منع الهلوسة والالتزام بمصادر حقيقية موثقة):
التزم حصرياً بإدراج هذه المصادر المحددة أدناه في قائمة المراجع في نهاية البحث والاستشهاد بها داخل المتن لضمان عدم تطابق المراجع مع أي نسخة أخرى، مع التأكيد الحاسم على استخدام مراجع حقيقية قابلة للتحقق (مثل ويكيبيديا العربية ar.wikipedia.org، موقع وموسوعة موضوع Mawdoo3.com، بنك المعرفة المصري EKB، دار المنظومة، والمستودعات الأكاديمية الرسمية) وممنوع منعاً باتاً اختلاق أو اختراع أسماء كتب أو مؤلفين وهميين:
${versionSourcesText}

القواعد الذهبية لنظام العناوين والمحتوى (أسلوب المقالات الموسوعية الكبرى وويكيبيديا):
- ممنوع منعاً باتاً استخدام أسطامبة "المبحث الأول" أو "المبحث الثاني" أو "الفصل الأول" أو "الفصل الثاني".
- استخرج وصِغ عناوين فرعية موضوعية حقيقية غنية ومباشرة نابعة من صلب موضوع (${sanitizedTopic}) ومنظور (${angle.name}) (مثل: "النشأة التاريخية وتطور الظاهرة"، "الأسس والمبادئ الحاكمة"، "المكونات والركائز الجوهرية"، "الآليات الميدانية ونماذج التطبيق"، "التحديات والمخاطر الراهنة"، "استشراف المستقبل والتحول المعاصر").
- مقياس التوسع والعمق لـ (${numPages}) صفحة (المستهدف حوالي ${targetWords} كلمة باللغة العربية الفصحى):
  اكتب بحثاً موسعاً يغطي ما لا يقل عن (${sectionCount}) عناوين موسوعية رئيسية متسلسلة، وتحت كل عنوان اكتب عدة فقرات تفصيلية، شروحات علمية، دراسات مقارنة، وأرقام واقتباسات دقيقة.
${customDetails && customDetails.trim() ? `شروط وملاحظات وتفاصيل خاصة مطلوبة بالبحث:\n${customDetails.trim()}\n` : ""}

قواعد إخراج النص وتنسيقه:
- ابدأ بنص البحث فوراً دون أي تحيات أو مقدمات من الذكاء الاصطناعي.
- العنوان الرئيسي: "بحث موسوعي ودراسة شاملة بعنوان: ${sanitizedTopic} (${angle.name})".
- اجعل العناوين الفرعية واضحة في سطور مستقلة تنتهي بنقطتين، وافصل بين كل عنوان وسياقه بسطر فارغ واحد فقط لضمان التدفق المستمر للنص.
- كافة النصوص باللغة العربية الفصحى المنسقة من اليمين إلى اليسار (RTL).
- أنهِ البحث بالخاتمة وقائمة المصادر والمراجع المحددة أعلاه.
- لا تستخدم علامات ماركداون معقدة (# أو ***).`;
    };

    // Helper for fetch with timeout
    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 25000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return res;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    // Helper to generate text from Gemini / Groq for a given prompt
    const callAIWithPrompt = async (prompt: string): Promise<{ text: string | null; provider: string }> => {
      // 1. Gemini
      let geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        try {
          const fs = await import("fs");
          const path = await import("path");
          const envPath = path.join(process.cwd(), ".env.local");
          if (fs.existsSync(envPath)) {
            const match = fs.readFileSync(envPath, "utf-8").match(/GEMINI_API_KEY=([^\r\n]+)/);
            if (match) geminiKey = match[1].trim();
          }
        } catch {}
      }

      if (geminiKey && geminiKey.length > 10 && !geminiKey.includes("placeholder")) {
        const geminiModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.5-pro"];
        for (const model of geminiModels) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
            const resp = await fetchWithTimeout(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 16384 },
              }),
            }, 30000);

            if (resp.ok) {
              const data = await resp.json();
              const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (candidate && candidate.trim().length > 150) {
                return { text: candidate, provider: `Google Gemini (${model})` };
              }
            }
          } catch {}
        }
      }

      // 2. Groq
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey && groqKey.startsWith("gsk_")) {
        try {
          const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
          const resp = await fetchWithTimeout(groqUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.7,
              max_tokens: 6000,
            }),
          }, 8000);

          if (resp.ok) {
            const data = await resp.json();
            const choice = data?.choices?.[0]?.message?.content;
            if (choice && choice.trim().length > 150) {
              return { text: choice, provider: "Groq (llama-3.3-70b)" };
            }
          }
        } catch {}
      }

      // 3. Pollinations.ai (Free Tier Fallback)
      try {
        const pollinationsUrl = "https://text.pollinations.ai/";
        const resp = await fetchWithTimeout(pollinationsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            model: "openai",
            seed: Math.floor(Math.random() * 10000),
          }),
        }, 8000);

        if (resp.ok) {
          const text = await resp.text();
          if (text && text.trim().length > 150) {
            return { text, provider: "Pollinations.ai (OpenAI)" };
          }
        }
      } catch {}

      return { text: null, provider: "Fallback Synthesizer" };
    };

    // 4. Generate the requested number of versions
    const versions: Array<{
      versionNumber: number;
      angle: AcademicAngle;
      content: string;
      provider: string;
      wordCount: number;
      estimatedPages: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      const angleIndex = (randomStartOffset + i) % ACADEMIC_ANGLES.length;
      const angle = ACADEMIC_ANGLES[angleIndex];
      const versionNum = i + 1;
      const prompt = buildPromptForAngle(angle, versionNum);

      const aiResult = await callAIWithPrompt(prompt);

      let finalContent = aiResult.text;
      let finalProvider = aiResult.provider;

      if (!finalContent || finalContent.trim().length < 150) {
        finalContent = generateAcademicFallback(
          sanitizedTopic,
          numPages,
          includeIntro,
          includeConclusion,
          includeRefs,
          angle,
          customSources,
          i
        );
        finalProvider = "محرك التوليد الأكاديمي الموسوعي (Copy-Cat Core Synthesizer)";
      }

      const words = finalContent.trim().split(/\s+/).filter(Boolean).length;
      const pagesCalc = Math.max(1, Math.round(words / 320));

      versions.push({
        versionNumber: versionNum,
        angle,
        content: finalContent,
        provider: finalProvider,
        wordCount: words,
        estimatedPages: pagesCalc,
      });
    }

    return NextResponse.json({
      success: true,
      topic: sanitizedTopic,
      targetPages: numPages,
      versions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء توليد البحث";
    console.error("API /api/research error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
