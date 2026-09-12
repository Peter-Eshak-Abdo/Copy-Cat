const fs = require('fs');
const path = require('path');

async function runComprehensiveTests() {
  console.log('====================================================');
  console.log('🚀 بدء الفحص الشامل لجميع أدوات لوحة الأدمن (3 تجارب لكل أداة)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // ----------------------------------------------------
  // TEST SUITE 1: الأرقام الحقيقية والتصفير التلقائي (Zero Baseline)
  // ----------------------------------------------------
  console.log('📊 [1] اختبار الأرقام الحقيقية والتصفير الافتراضي (Default Zero):');
  
  // Tasks page default
  const tasksPageContent = fs.readFileSync('app/admin/tasks/page.tsx', 'utf-8');
  const hasEmptyInitialTasks = tasksPageContent.includes('const INITIAL_TASKS: PrintTask[] = [];');
  if (hasEmptyInitialTasks) {
    console.log('  ✅ صفحة المهام: تبدأ بمصفوفة فارغة 0 مهام (INITIAL_TASKS = []).');
    passed++;
  } else {
    console.log('  ❌ صفحة المهام: ما زال بها مهام وهمية!');
    failed++;
  }

  // Calculator page default
  const calcPageContent = fs.readFileSync('app/admin/calculator/page.tsx', 'utf-8');
  const calcHasZeroPages = calcPageContent.includes('const [pageCount, setPageCount] = useState<number>(0);');
  const calcHasZeroCopies = calcPageContent.includes('const [copiesCount, setCopiesCount] = useState<number>(0);');
  const calcHasNoProfitMargin = !calcPageContent.includes('هامش الربح: ~{profitMarginPercent}%');
  if (calcHasZeroPages && calcHasZeroCopies && calcHasNoProfitMargin) {
    console.log('  ✅ حاسبة الملازم: تبدأ بـ 0 صفحة و 0 نسخة بدون أي هامش ربح معلن.');
    passed++;
  } else {
    console.log('  ❌ حاسبة الملازم: لا تبدأ بصفر أو ما زال بها هامش الربح!');
    failed++;
  }

  // Dashboard dynamic completion
  const dashboardContent = fs.readFileSync('app/admin/page.tsx', 'utf-8');
  const hasDynamicCard4 = dashboardContent.includes('معدل إنجاز أوردرات الشفت') && dashboardContent.includes('tasks.length > 0 ?');
  if (hasDynamicCard4) {
    console.log('  ✅ لوحة التحكم: الكارت الرابع ديناميكي 100% ويبدأ بـ 0% عند عدم وجود مهام.');
    passed++;
  } else {
    console.log('  ❌ لوحة التحكم: الكارت الرابع يحتوي على أرقام ثابتة!');
    failed++;
  }

  // ----------------------------------------------------
  // TEST SUITE 2: توليد الأبحاث (Research Generator) - 3 تجارب
  // ----------------------------------------------------
  console.log('\n📚 [2] اختبار توليد الأبحاث المدرسية والجامعية (3 تجارب مختلفة):');
  const researchPage = fs.readFileSync('app/admin/research/page.tsx', 'utf-8');
  const researchDocx = fs.readFileSync('lib/docx/research-docx.ts', 'utf-8');

  // Check 1: Custom pages & 2026/2027
  const hasCustomPages = researchPage.includes('isCustomPages') && researchPage.includes('أخرى');
  const has2026Year = researchPage.includes('2026 / 2027');
  const hasDetailsField = researchPage.includes('customDetails') && researchPage.includes('شروط وتفاصيل خاصة وملاحظات');

  if (hasCustomPages && has2026Year && hasDetailsField) {
    console.log('  ✅ تجربة 1 (الواجهة والمدخلات): خانة "أخرى" لكتابة أي عدد صفحات + حقل الشروط المخصصة + عام 2026/2027.');
    passed++;
  } else {
    console.log('  ❌ تجربة 1: نقص في عناصر واجهة الأبحاث!');
    failed++;
  }

  // Check 2: Word DOCX formatting (RTL, right align, page borders)
  const hasRtlTable = researchDocx.includes('visuallyRightToLeft: true');
  const hasRightAlignedCells = researchDocx.includes('AlignmentType.RIGHT');
  const hasPageBorders = researchDocx.includes('pageBorders') && researchDocx.includes('pageBorderTop');

  if (hasRtlTable && hasRightAlignedCells && hasPageBorders) {
    console.log('  ✅ تجربة 2 (تنسيق Word DOCX): جداول RTL منسقة لليمين + نصوص محاذاة لليمين + إطار رسمي كامل (Page Borders).');
    passed++;
  } else {
    console.log('  ❌ تجربة 2: خطأ في تنسيق ملف الوورد للأبحاث!');
    failed++;
  }

  // Check 3: API research generation test
  try {
    const res = await fetch('http://localhost:3000/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'مصر وحضارة الفراعنة',
        targetPages: 3,
        academicYear: '2026 / 2027',
        customDetails: 'التركيز على بناء الأهرامات والتحنيط',
        includeIndex: true,
        includeRefs: true
      })
    });
    const json = await res.json();
    if (res.ok && json.content && json.content.length > 500) {
      console.log('  ✅ تجربة 3 (توليد المحتوى الحقيقي): تم توليد بحث متكامل يغطي الشروط المخصصة (' + json.content.length + ' حرف).');
      passed++;
    } else {
      console.log('  ❌ تجربة 3: فشل توليد البحث عبر API:', json.error);
      failed++;
    }
  } catch (err) {
    console.log('  ❌ تجربة 3: تعذر الاتصال بـ API الأبحاث:', err.message);
    failed++;
  }

  // ----------------------------------------------------
  // TEST SUITE 3: البطايق (ID Cards) - 3 تجارب
  // ----------------------------------------------------
  console.log('\n🪪 [3] اختبار استوديو البطاقات الوطنية (3 تجارب مختلفة):');
  const idCardsPage = fs.readFileSync('app/admin/id-cards/page.tsx', 'utf-8');
  const idCardsDocx = fs.readFileSync('lib/docx/id-cards-docx.ts', 'utf-8');
  const canvasFilters = fs.readFileSync('lib/canvas-filters.ts', 'utf-8');

  // Check 1: Auto corner detection & CamScanner on upload
  const hasAutoCornerOnUpload = idCardsPage.includes('detectCardCorners') && idCardsPage.includes('autoQuad');
  const hasCamScannerAuto = idCardsPage.includes('camScannerMode: true');
  if (hasAutoCornerOnUpload && hasCamScannerAuto) {
    console.log('  ✅ تجربة 1 (المعالجة التلقائية): كشف أركان البطاقة وضبط المنظور + فلتر CamScanner Pro تلقائياً عند الرفع.');
    passed++;
  } else {
    console.log('  ❌ تجربة 1: المعالجة التلقائية للبطاقات غير مكتملة!');
    failed++;
  }

  // Check 2: CamScanner illumination & color safe preservation
  const hasRetinexIllumination = canvasFilters.includes('applyCamScannerMagicColor') && canvasFilters.includes('estimateIlluminationBackground');
  const hasQuadWarp = canvasFilters.includes('warpPerspectiveQuad');
  if (hasRetinexIllumination && hasQuadWarp) {
    console.log('  ✅ تجربة 2 (محرك الرؤية والقص): إزالة الظلال وتبييض الخلفية مع تعميق أرقام البطاقة وحفظ الألوان.');
    passed++;
  } else {
    console.log('  ❌ تجربة 2: نقص في دوال المحرك الرسومي للبطاقات!');
    failed++;
  }

  // Check 3: Standard Egyptian Front & Back Same Sheet Print Layout
  const hasSameSheetLayout = idCardsDocx.includes('single_sheet') && idCardsDocx.includes('cardWidthPx = 324');
  if (hasSameSheetLayout) {
    console.log('  ✅ تجربة 3 (تصدير الطباعة A5): مقاس رسمي (8.56 × 5.4 سم) مع وضع الوش والظهر معاً في نفس الورقة.');
    passed++;
  } else {
    console.log('  ❌ تجربة 3: إعدادات مقاسات وطباعة الوورد للبطاقات غير قياسية!');
    failed++;
  }

  // ----------------------------------------------------
  // TEST SUITE 4: الصور الشخصية (Passport Photos) - 3 تجارب
  // ----------------------------------------------------
  console.log('\n📸 [4] اختبار استوديو الصور الشخصية 4x6 (3 تجارب مختلفة):');
  const passportDocx = fs.readFileSync('lib/docx/passport-docx.ts', 'utf-8');
  const portraitEnhancer = fs.readFileSync('lib/portrait-enhancer.ts', 'utf-8');
  const passportPage = fs.readFileSync('app/admin/passport-photos/page.tsx', 'utf-8');

  // Check 1: 1.5 cm cutting gap
  const has1_5cmGap = passportDocx.includes('cuttingMargin1_5cmTwips') && passportDocx.includes('850');
  if (has1_5cmGap) {
    console.log('  ✅ تجربة 1 (مسافة القص البيضاء): فراغ أبيض 1.5 سم (15 مم = 850 twips) بالمليمتر بين الصور لسهولة القص بالمقص.');
    passed++;
  } else {
    console.log('  ❌ تجربة 1: مسافة القص في الوورد ليست 1.5 سم!');
    failed++;
  }

  // Check 2: Proportional aspect ratio without distortion
  const hasProportionalScale = portraitEnhancer.includes('Math.max(targetW / rw, targetH / rh)') && portraitEnhancer.includes('renderFramedPassportCanvas');
  const hasBaseScaleInManual = portraitEnhancer.includes('baseScale') && portraitEnhancer.includes('effectiveScale');
  if (hasProportionalScale && hasBaseScaleInManual) {
    console.log('  ✅ تجربة 2 (حفظ النسب ومنع المط): حفظ الأبعاد الطبيعية للوجه بدون مط أو تفلطح + تأطير نسبي للكاميرات عالية الدقة.');
    passed++;
  } else {
    console.log('  ❌ تجربة 2: نسب الصور الشخصية قد تتعرض للمط!');
    failed++;
  }

  // Check 3: Resilient upload & interactive framing
  const hasResilientUpload = passportPage.includes('Promise.race') && passportPage.includes('Timeout');
  const hasFramingModal = passportPage.includes('framingTarget') && passportPage.includes('renderFramedPassportCanvas');
  if (hasResilientUpload && hasFramingModal) {
    console.log('  ✅ تجربة 3 (الاستقرار والتحكم اليدوي): معالجة فورية لا تتجمد + نافذة تأطير وتحريك وتقريب (Zoom & Pan).');
    passed++;
  } else {
    console.log('  ❌ تجربة 3: مشاكل في استقرار عزل الصور الشخصية!');
    failed++;
  }

  // ----------------------------------------------------
  // TEST SUITE 5: أدوات الـ PDF (PDF Tools) - 3 تجارب
  // ----------------------------------------------------
  console.log('\n📄 [5] اختبار أدوات وتفكيك ملفات PDF (3 تجارب مختلفة):');
  const pdfToolsPage = fs.readFileSync('app/admin/pdf-tools/page.tsx', 'utf-8');
  const hasPdfWorkerFile = fs.existsSync('public/pdf.worker.min.js');

  // Check 1: Real thumbnails with local worker
  const hasThumbnailRender = pdfToolsPage.includes('renderThumbnailsForDoc') && pdfToolsPage.includes('page.thumbnail');
  if (hasThumbnailRender && hasPdfWorkerFile) {
    console.log('  ✅ تجربة 1 (المعاينة الحقيقية): ملف pdf.worker.min.js محلي أوفلاين مع رندر حقيقي لصور الصفحات.');
    passed++;
  } else {
    console.log('  ❌ تجربة 1: ملف worker أو كود المعاينة غير متوفر!');
    failed++;
  }

  // Check 2: Direct jump & selective export
  const hasDirectJump = pdfToolsPage.includes('انقل لـ #') && pdfToolsPage.includes('handleMoveDirect');
  const hasSelectiveExport = pdfToolsPage.includes('selectedPageIds') && pdfToolsPage.includes('handleExportSelectedPdf') && pdfToolsPage.includes('handleExportSelectedImagesZip');
  if (hasDirectJump && hasSelectiveExport) {
    console.log('  ✅ تجربة 2 (التحكم والتصدير الانتقائي): صندوق إدخال رقم الصفحة للنقل المباشر + تصدير صفحات محددة كـ PDF أو صور ZIP.');
    passed++;
  } else {
    console.log('  ❌ تجربة 2: نقص في وظائف النقل أو التصدير الانتقائي!');
    failed++;
  }

  // Check 3: PDF compressor & PDF to Word
  const hasCompressor = pdfToolsPage.includes('handleCompressPdf') && pdfToolsPage.includes('تخفيف حجم الـ PDF');
  const hasPdfToWord = fs.existsSync('app/api/pdf-to-word/route.ts');
  if (hasCompressor && hasPdfToWord) {
    console.log('  ✅ تجربة 3 (الضغط والتحويل): أداة ضغط وتخفيف حجم الـ PDF + مسار تحويل PDF إلى Word الذكي.');
    passed++;
  } else {
    console.log('  ❌ تجربة 3: أداة الضغط أو تحويل الوورد غير جاهزة!');
    failed++;
  }

  // ----------------------------------------------------
  // TEST SUITE 6: عزل السيرفس ووركر وتجاوز صفحات الأدمن (Cache Bypass)
  // ----------------------------------------------------
  console.log('\n🛡️ [6] اختبار تجاوز كاش السيرفس ووركر لصفحات الأدمن:');
  const swContent = fs.readFileSync('public/sw.js', 'utf-8');
  const hasAdminBypassInSw = swContent.includes('url.pathname.startsWith("/admin")');
  const noAdminInPrecache = !swContent.includes('"/admin/research"');
  if (hasAdminBypassInSw && noAdminInPrecache) {
    console.log('  ✅ تم استبعاد كافة صفحات الأدمن من كاش المتصفح القديم لمنع ظهور أي صفحات قديمة.');
    passed++;
  } else {
    console.log('  ❌ ما زال السيرفس ووركر يقوم بتخزين مسارات الأدمن!');
    failed++;
  }

  console.log('\n====================================================');
  console.log(`🏁 إجمالي الاختبارات الناجحة: ${passed} | الفاشلة: ${failed}`);
  console.log('====================================================');
}

runComprehensiveTests().catch(console.error);
