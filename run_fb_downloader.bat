@echo off
chcp 65001 >nul
echo =======================================================
echo   تشغيل اسكربت سحب صور صفحة فيسبوك لمكتبة كوبى كات
echo =======================================================

if not exist ".venv\Scripts\python.exe" (
    echo [!] جاري تجهيز البيئة الافتراضية .venv لأول مرة...
    python -m venv .venv
    call .venv\Scripts\activate
    pip install playwright requests pillow
)

echo [+] بدء تشغيل الاسكربت...
.venv\Scripts\python.exe scripts\download_fb_photos.py %*

echo.
echo =======================================================
echo   تم الانتهاء! اضغط أي زر للإغلاق.
echo =======================================================
pause
