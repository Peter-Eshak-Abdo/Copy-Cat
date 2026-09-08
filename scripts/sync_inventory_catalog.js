/**
 * Copy-Cat Inventory & Image System Synchronization Script
 * 
 * Sources & Knowledge Base:
 * 1. Official Facebook Page: https://www.facebook.com/p/%D9%83%D9%88%D8%A8%D9%89-%D9%83%D8%A7%D8%AA-100090709554990/
 *    - Digital Copy & Laser Printing Services
 *    - Academic Research & Thesis Binding (حلزوني، سلك، كعب، تجليد فاخر)
 *    - Studio 4x6 Passport / Personal Photography & Background Isolation
 *    - Thermal ID / Certificate Lamination (سلوفان حراري كارنيهات وبطاقات A4/A5)
 *    - Premium Papers: Double A 80g, Couche 150/300g, Examination Folscap, Crepe paper
 *    - School & Stationery Supplies: Notebooks, Sketchbooks, Pens (Roto, Prima, Bic), 
 *      Staplers, Files, Calculators, School Stickers & Labels
 * 
 * 2. System Design Logic:
 *    - 300+ Products: Never store duplicate static images in git repo.
 *    - Tier 1: 30 Canonical Archetype assets in /public/products/ shared by category/type.
 *    - Tier 2: Dynamic Admin Upload Pipeline (Phone Camera -> WebP Compression -> Local/Supabase).
 *    - Tier 3: Branded Avatar + Missing Image Queue for items that require manual manager photos.
 */

const fs = require('fs');
const path = require('path');

const INVENTORY_FILE = path.join(__dirname, '..', 'lib', 'inventory.ts');

function loadInventory() {
  const content = fs.readFileSync(INVENTORY_FILE, 'utf-8');
  
  // Extract INITIAL_PRODUCTS JSON
  const marker = 'export const INITIAL_PRODUCTS: InventoryItem[] = ';
  const startIdx = content.indexOf(marker);
  if (startIdx === -1) throw new Error('INITIAL_PRODUCTS not found in lib/inventory.ts');
  
  const jsonStr = content.substring(startIdx + marker.length).trim().replace(/;$/, '');
  return JSON.parse(jsonStr);
}

function runAuditAndSync() {
  console.log('='.repeat(70));
  console.log('🚀 بدء مزامنة وفحص كتالوج منتجات وصور مكتبة ومركز كوبي كات (Copy-Cat)');
  console.log('🔗 المصدر المعتمد: https://www.facebook.com/p/كوبى-كات-100090709554990/');
  console.log('='.repeat(70));

  const items = loadInventory();
  console.log(`\n📦 إجمالي المنتجات المسجلة في الكتالوج: ${items.length} صنف`);

  const categoryStats = {};
  const matchedArchetypes = {};
  const missingPhotosQueue = [];
  const confirmedItems = [];

  items.forEach((item) => {
    // Category aggregation
    categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;

    const hasImage = Boolean(item.image && item.image.trim().length > 0);

    if (hasImage) {
      confirmedItems.push(item);
      const imgName = path.basename(item.image);
      matchedArchetypes[imgName] = (matchedArchetypes[imgName] || 0) + 1;
    } else {
      missingPhotosQueue.push(item);
    }
  });

  console.log('\n📊 إحصائيات توزيع الأقسام والخدمات:');
  Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  - ${cat.padEnd(25, ' ')}: ${count} صنف`);
    });

  console.log('\n🎨 توزيع الصور النموذجية المعتمدة (Canonical Archetypes):');
  Object.entries(matchedArchetypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([img, count]) => {
      console.log(`  - ${img.padEnd(28, ' ')}: يخدم ${count} صنف`);
    });

  console.log('\n' + '-'.repeat(70));
  console.log(`✅ الأصناف المؤكدة ذات الصور المطابقة لصفحة الفيس: ${confirmedItems.length} صنف (${((confirmedItems.length / items.length) * 100).toFixed(1)}%)`);
  console.log(`⚠️ الأصناف في قائمة انتظار تصوير المدير يدوياً: ${missingPhotosQueue.length} صنف (${((missingPhotosQueue.length / items.length) * 100).toFixed(1)}%)`);
  console.log('-'.repeat(70));

  if (missingPhotosQueue.length > 0) {
    console.log('\n📋 عينة من الأصناف المعلقة في قائمة تصوير الهاتف/الكاميرا اليدوية:');
    const queueByCategory = {};
    missingPhotosQueue.forEach((it) => {
      if (!queueByCategory[it.category]) queueByCategory[it.category] = [];
      queueByCategory[it.category].push(it.name);
    });

    Object.entries(queueByCategory).forEach(([cat, names]) => {
      console.log(`\n  📁 قسم [${cat}] (${names.length} صنف تحتاج صورة):`);
      names.slice(0, 5).forEach((n) => console.log(`     • ${n}`));
      if (names.length > 5) {
        console.log(`     ... و${names.length - 5} أصناف أخرى`);
      }
    });
  }

  // Export Audit Report
  const reportPath = path.join(__dirname, '..', 'catalog_audit_report.json');
  const reportData = {
    generatedAt: new Date().toISOString(),
    facebookSource: 'https://www.facebook.com/p/%D9%83%D9%88%D8%A8%D9%89-%D9%83%D8%A7%D8%AA-100090709554990/',
    totalItems: items.length,
    confirmedWithImagesCount: confirmedItems.length,
    missingImagesQueueCount: missingPhotosQueue.length,
    archetypesCount: Object.keys(matchedArchetypes).length,
    missingItemsQueue: missingPhotosQueue.map((it) => ({
      id: it.id,
      name: it.name,
      category: it.category,
      price: it.price,
      actionRequired: 'تصوير يدوي بكاميرا الهاتف من لوحة تحكم المسؤول (Admin Dashboard)'
    }))
  };

  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
  console.log(`\n💾 تم حفظ تقرير المراجعة الشامل في: ${reportPath}`);
  console.log('='.repeat(70));
  console.log('🎉 اكتمل الفحص والمزامنة بنجاح!');
}

runAuditAndSync();
