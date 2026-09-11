import os
import sys
import time
import argparse
import hashlib
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image
from io import BytesIO
from playwright.sync_api import sync_playwright

# Defaults
DEFAULT_PAGE_URL = "https://www.facebook.com/p/%D9%83%D9%88%D8%A8%D9%89-%D9%83%D8%A7%D8%AA-100090709554990/"
DEFAULT_EMAIL = os.environ.get("FB_EMAIL", "")
DEFAULT_PASSWORD_1 = os.environ.get("FB_PASSWORD", "")
DEFAULT_OUTPUT_DIR = os.path.join("public", "uploads", "pool")
USER_DATA_DIR = "fb_profile"


def clean_url(url: str) -> str:
    """Removes transient tracking parameters from image URLs to deduplicate properly."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


def is_likely_content_photo(url: str) -> bool:
    """Filter out static assets, tracking pixels, emojis, and UI icons."""
    url_lower = url.lower()
    if any(blocked in url_lower for blocked in [
        "rsrc.php", "emoji.php", "static.xx.fbcdn.net",
        "interncache", "/badges/", "/icons/", "favicon",
        "p50x50", "s50x50", "p32x32", "s32x32", "p100x100"
    ]):
        return False

    if "fbcdn.net" in url_lower or "facebook.com" in url_lower:
        return True
    return False


def is_authenticated(context) -> bool:
    """Checks if the Facebook session cookie 'c_user' is present."""
    cookies = context.cookies()
    for c in cookies:
        if c.get("name") == "c_user" and c.get("value"):
            return True
    return False


def setup_browser(playwright_instance, headless=False):
    """Launches Chromium with persistent session storage."""
    profile_path = os.path.abspath(USER_DATA_DIR)
    os.makedirs(profile_path, exist_ok=True)

    kwargs = {
        "user_data_dir": profile_path,
        "headless": headless,
        "viewport": {"width": 1366, "height": 850},
        "args": [
            "--disable-blink-features=AutomationControlled",
            "--disable-notifications",
            "--no-first-run",
            "--no-default-browser-check"
        ]
    }

    try:
        print("[+] جاري تشغيل متصفح Chromium المخصص لحفظ جلسة فيسبوك...")
        context = playwright_instance.chromium.launch_persistent_context(**kwargs)
        print("[✓] تم تشغيل المتصفح بنجاح!")
        return context
    except Exception as e:
        print(f"[!] تنبيه تشغيل Chromium: {e}")
        print("[+] محاولة استخدام متصفح Edge كبديل...")
        kwargs["channel"] = "msedge"
        return playwright_instance.chromium.launch_persistent_context(**kwargs)


def dismiss_cookie_popups(page):
    cookie_buttons = [
        'button[data-cookiebanner="accept_button"]',
        'button[data-cookiebanner="accept_only_essential_button"]',
        'div[aria-label="Allow all cookies"]',
        'div[aria-label="Allow essential and optional cookies"]',
        'div[aria-label="Decline optional cookies"]',
        'button:has-text("السماح بجميع ملفات تعريف الارتباط")',
        'button:has-text("قبول الكل")',
        'button:has-text("Allow all cookies")',
        'button:has-text("Only allow essential cookies")',
        'div[aria-label="إغلاق"]',
        'div[aria-label="Close"]'
    ]
    for sel in cookie_buttons:
        try:
            loc = page.locator(sel).first
            if loc.is_visible(timeout=1000):
                loc.click()
                time.sleep(0.5)
                break
        except Exception:
            pass


def check_and_login(page, context, email, password):
    """Navigates to Facebook, logs in, and verifies session."""
    print("[+] فتح موقع فيسبوك للتحقق من حالة الحساب...")
    page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=60000)
    time.sleep(2)
    dismiss_cookie_popups(page)

    if is_authenticated(context):
        print("[✓] جلسة فيسبوك نشطة ومسجلة الدخول مسبقاً!")
        return

    if email and password:
        print(f"[+] محاولة تسجيل الدخول التلقائي للحساب: {email}...")
        try:
            email_field = page.locator('#email, input[name="email"]').first
            if email_field.is_visible(timeout=2500):
                email_field.fill(email)
                time.sleep(0.5)

            pass_field = page.locator('#pass, input[name="pass"]').first
            if pass_field.is_visible(timeout=2500):
                pass_field.fill(password)
                time.sleep(0.5)

            login_btn = page.locator('button[name="login"], #loginbutton, button[type="submit"]').first
            if login_btn.is_visible(timeout=2000):
                login_btn.click()
            else:
                page.keyboard.press("Enter")

            time.sleep(4)
            dismiss_cookie_popups(page)
        except Exception as e:
            print(f"[!] ملاحظة الملء التلقائي: {e}")

    if is_authenticated(context):
        print("[✓] تم تسجيل الدخول بنجاح تام!")
        return

    print("\n" + "=" * 70)
    print("👉 نافذة المتصفح مفتوحة أمامك الآن على شاشة الكمبيوتر:")
    print("   1. يمكنك مراجعة الإيميل والباسورد أو إدخال كود الأمان داخل المتصفح مباشرة.")
    print("   2. بمجرد فتح الصفحة الرئيسية، سيكتشف الاسكربت الجلسة ويكمل السحب آلياً.")
    print("=" * 70)

    wait_time = 0
    while wait_time < 300:
        if is_authenticated(context):
            print("\n[✓] تم تأكيد نجاح تسجيل الدخول وحفظ الجلسة!")
            time.sleep(1.5)
            return
        time.sleep(2)
        wait_time += 2
        print(".", end="", flush=True)

    print("\n[!] متابعة العمل ومحاولة سحب الصور المتاحة علنياً...")


def extract_all_album_links(page):
    """Scrapes the photos_albums tab and returns unique album URLs."""
    album_urls = set()
    print("[+] جاري فحص واكتشاف كافة ألبومات صور المكتبة...")
    try:
        page.goto("https://www.facebook.com/100090709554990/photos_albums", wait_until="domcontentloaded", timeout=45000)
        time.sleep(3)
        dismiss_cookie_popups(page)

        # Scroll albums list
        for _ in range(8):
            page.evaluate("window.scrollBy(0, 1000);")
            time.sleep(1.2)

        links = page.eval_on_selector_all(
            'a[href*="/media/set/"], a[href*="set=a."]',
            'elements => elements.map(e => e.href)'
        )
        for l in links:
            if l and "facebook.com" in l:
                album_urls.add(l)

        print(f"[✓] تم اكتشاف {len(album_urls)} ألبوم مستقل للصور!")
    except Exception as e:
        print(f"[!] ملاحظة عند استخراج الألبومات: {e}")

    return list(album_urls)


def collect_images_from_page(page, context, target_url, output_dir, max_scrolls=80, wipe_first=False):
    """Visits page sections, scrolls continuously, intercepts and downloads photos without duplicates."""
    os.makedirs(output_dir, exist_ok=True)

    if wipe_first:
        print("\n" + "=" * 70)
        print("⚠️ تم تفعيل خيار المسح النظيف (--wipe-first):")
        print(f"   جاري تفريغ المجلد '{output_dir}' للبدء على نضافة كاملة بدون أي تكرارات...")
        deleted_count = 0
        for item in os.listdir(output_dir):
            item_path = os.path.join(output_dir, item)
            try:
                if os.path.isfile(item_path):
                    os.unlink(item_path)
                    deleted_count += 1
            except Exception:
                pass
        print(f"[✓] تم مسح {deleted_count} ملف قديم بنجاح.")
        print("=" * 70)

    captured_urls = set()
    downloaded_hashes = set()

    # Pre-index existing files to prevent duplicates
    for f in os.listdir(output_dir):
        fp = os.path.join(output_dir, f)
        if os.path.isfile(fp) and f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            try:
                with open(fp, 'rb') as img_f:
                    downloaded_hashes.add(hashlib.md5(img_f.read()).hexdigest())
            except Exception:
                pass

    print(f"[+] الصور المعتمدة مسبقاً في المجلد: {len(downloaded_hashes)} صورة")

    # 1. Hook Network Responses: Listen to CDN images AND GraphQL payloads
    def handle_response(response):
        try:
            url = response.url
            content_type = response.headers.get("content-type", "")

            # Direct high-res CDN images
            if ("image" in content_type or ".fbcdn.net" in url) and is_likely_content_photo(url):
                captured_urls.add(url)

            # Deep GraphQL interception: extracts high-res image URLs from JSON stream
            if "/api/graphql/" in url or "graphql" in url:
                try:
                    body_text = response.text()
                    matches = re.findall(r'https:[^"\\\s]+fbcdn\.net[^"\\\s]+', body_text)
                    for m in matches:
                        clean_m = m.replace('\\/', '/').replace('&amp;', '&')
                        if is_likely_content_photo(clean_m):
                            captured_urls.add(clean_m)
                except Exception:
                    pass
        except Exception:
            pass

    page.on("response", handle_response)

    # 2. Discover all individual albums
    discovered_albums = extract_all_album_links(page)

    # 3. Core sections to crawl
    core_urls = [
        target_url,
        "https://www.facebook.com/100090709554990/photos",
        "https://www.facebook.com/100090709554990/photos_by",
    ]

    all_targets = core_urls + discovered_albums

    for section_idx, section_url in enumerate(all_targets, 1):
        print("\n" + "-" * 70)
        print(f"[+] [{section_idx}/{len(all_targets)}] جاري سحب الصور من: {section_url}")
        print("-" * 70)
        try:
            page.goto(section_url, wait_until="domcontentloaded", timeout=60000)
            time.sleep(2.5)
            dismiss_cookie_popups(page)
        except Exception as e:
            print(f"[!] ملاحظة عند فتح {section_url}: {e}")
            continue

        last_height = 0
        consecutive_no_change = 0
        scroll_limit = max_scrolls if section_idx <= 3 else 30

        for scroll_idx in range(1, scroll_limit + 1):
            try:
                # Capture current DOM images before virtualization unmounts them
                dom_images = page.eval_on_selector_all(
                    'img',
                    '''elements => elements.map(el => ({
                        src: el.src,
                        currentSrc: el.currentSrc,
                        srcset: el.srcset,
                        w: el.naturalWidth || el.width,
                        h: el.naturalHeight || el.height
                    }))'''
                )
                for item in dom_images:
                    for s in [item.get('src'), item.get('currentSrc')]:
                        if s and is_likely_content_photo(s):
                            captured_urls.add(s)

                    srcset = item.get('srcset')
                    if srcset:
                        for chunk in srcset.split(','):
                            parts = chunk.strip().split(' ')
                            if len(parts) > 0 and is_likely_content_photo(parts[0]):
                                captured_urls.add(parts[0])
            except Exception:
                pass

            # Smooth scroll down
            page.evaluate("window.scrollBy(0, 1100);")
            time.sleep(1.4)

            current_height = page.evaluate("document.body.scrollHeight")
            print(f"  [تمرير {scroll_idx}/{scroll_limit}] - تم التقاط {len(captured_urls)} رابط صورة حتى الآن...", end="\r")

            if current_height == last_height:
                consecutive_no_change += 1
                if consecutive_no_change >= 5:
                    print(f"\n[✓] اكتمل تصفح كامل محتوى هذا القسم.")
                    break
            else:
                consecutive_no_change = 0
                last_height = current_height

        print(f"\n[+] إجمالي الروابط المرصودة حتى الآن: {len(captured_urls)}")

    # 4. High-Res Filter, Download & Strict Content Deduplication
    print("\n" + "=" * 70)
    print(f"[+] بدء تحميل وفحص جودة {len(captured_urls)} صورة في المجلد: '{output_dir}'...")
    print("=" * 70)

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        "Referer": "https://www.facebook.com/"
    })
    for cookie in context.cookies():
        session.cookies.set(cookie['name'], cookie['value'], domain=cookie.get('domain', ''))

    counter = len(downloaded_hashes) + 1
    new_saved = 0

    for img_url in captured_urls:
        try:
            res = session.get(img_url, timeout=20)
            if res.status_code != 200 or len(res.content) < 14000:
                continue

            # Check dimensions with PIL
            try:
                img_io = BytesIO(res.content)
                img = Image.open(img_io)
                width, height = img.size

                # Discard thumbnails or icons
                if width < 220 and height < 220:
                    continue

                # Strict byte-level deduplication
                content_hash = hashlib.md5(res.content).hexdigest()
                if content_hash in downloaded_hashes:
                    continue

                img_format = (img.format or "JPEG").lower()
                ext = "jpg" if img_format == "jpeg" else img_format

                filename = f"copycat_photo_{counter:03d}.{ext}"
                filepath = os.path.join(output_dir, filename)

                with open(filepath, "wb") as f_out:
                    f_out.write(res.content)

                downloaded_hashes.add(content_hash)
                counter += 1
                new_saved += 1
                print(f"[{counter-1}] ✓ تم حفظ: {filename} ({width}x{height} بكسل - {len(res.content)//1024} KB)")

            except Exception:
                continue

        except Exception:
            continue

    print("\n" + "=" * 70)
    print(f"[✓] اكتملت المهمة بنجاح تام وبدون أي تكرارات!")
    print(f"  • صور جديدة تم تحميلها وحفظها: {new_saved}")
    print(f"  • إجمالي الصور المعتمدة في بنك الصور: {len(downloaded_hashes)}")
    print(f"  • مسار المجلد على الموقع: {os.path.abspath(output_dir)}")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Facebook Photos Scraper & Pool Uploader for Copy-Cat")
    parser.add_argument("--url", default=DEFAULT_PAGE_URL, help="Facebook page URL")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help="Facebook login email")
    parser.add_argument("--password", default=DEFAULT_PASSWORD_1, help="Facebook login password")
    parser.add_argument("--out", default=DEFAULT_OUTPUT_DIR, help="Output directory")
    parser.add_argument("--scrolls", type=int, default=80, help="Max scrolls per section")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode")
    parser.add_argument("--wipe-first", action="store_true", help="Wipe existing pool before downloading fresh")

    args = parser.parse_args()

    print("=" * 75)
    print("  🚀 Copy-Cat Facebook Photos Downloader | أداة سحب صور فيسبوك المطورة")
    print("=" * 75)
    print(f"• الصفحة المستهدفة: {args.url}")
    print(f"• مجلد الحفظ على الموقع: {os.path.abspath(args.out)}")
    print(f"• وضع المسح النظيف (--wipe-first): {'مفعّل' if args.wipe_first else 'غير مفعّل (دمج وتفادي التكرار)'}")
    print("=" * 75)

    with sync_playwright() as playwright:
        context = setup_browser(playwright, headless=args.headless)
        page = context.new_page()

        try:
            check_and_login(page, context, args.email, args.password)
            collect_images_from_page(
                page,
                context,
                args.url,
                args.out,
                max_scrolls=args.scrolls,
                wipe_first=args.wipe_first
            )
        finally:
            print("[+] حفظ الجلسة وإغلاق المتصفح...")
            context.close()


if __name__ == "__main__":
    main()
