@echo off
chcp 65001 >nul
echo =======================================================
echo   🚀 سحب صور صفحة فيسبوك مكتبة كوبى كات (Copy-Cat)
echo =======================================================

if not exist ".venv\Scripts\python.exe" (
    echo [!] جاري تجهيز البيئة الافتراضية .venv لأول مرة...
    python -m venv .venv
    call .venv\Scripts\activate
    pip install playwright requests pillow
)

echo.
echo اختر طريقة التشغيل:
echo [1] سحب كافة الصور والألبومات مع تفادي أي تكرار (دمج ذكي)
echo [2] مسح المجلد الحالي والبدء على نضافة كاملة (--wipe-first)
echo.
set /p choice="أدخل اختيارك (1 أو 2) [افتراضي 1]: "

if "%choice%"=="2" (
    echo.
    echo [!] جاري تشغيل الاسكربت مع المسح النظيف...
    .venv\Scripts\python.exe scripts\download_fb_photos.py --wipe-first %*
) else (
    echo.
    echo [+] جاري تشغيل الاسكربت بالوضع العادي (تجاوز سقف 155 صورة وسحب الألبومات)...
    .venv\Scripts\python.exe scripts\download_fb_photos.py %*
)

echo.
echo =======================================================
echo [+] جاري مزامنة كتالوج منتجات الموقع مع الصور الجديدة...
node scripts\sync_inventory_catalog.js
echo.
echo =======================================================
echo   تم الانتهاء بنجاح! اضغط أي زر للإغلاق.
echo =======================================================
pause
