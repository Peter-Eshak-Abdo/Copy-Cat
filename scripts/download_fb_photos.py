import os
import sys
import time
import argparse
import hashlib
import re
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
        "interncache", "/badges/", "/icons/", "favicon"
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
    """Launches isolated Chromium with persistent session storage."""
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
        print("[+] جاري تشغيل متصفح Chromium المخصص...")
        context = playwright_instance.chromium.launch_persistent_context(**kwargs)
        print("[✓] تم تشغيل المتصفح بنجاح!")
        return context
    except Exception as e:
        print(f"[!] حدث خطأ أثناء تشغيل Chromium: {e}")
        print("[+] محاولة تشغيل متصفح Edge كخيار بديل...")
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
        'button:has-text("Only allow essential cookies")'
    ]
    for sel in cookie_buttons:
        try:
            loc = page.locator(sel).first
            if loc.is_visible(timeout=1500):
                loc.click()
                print("[+] تم إغلاق نافذة ملفات تعريف الارتباط (Cookies)")
                time.sleep(1)
                break
        except Exception:
            pass


def check_and_login(page, context, email, password):
    """Navigates to Facebook, logs in, and verifies session."""
    print("[+] فتح موقع فيسبوك للتحقق من حالة الحساب...")
    page.goto("https://www.facebook.com/", wait_until="domcontentloaded", timeout=60000)
    time.sleep(3)
    dismiss_cookie_popups(page)

    # Check if already authenticated
    if is_authenticated(context):
        print("[✓] الحساب مسجل الدخول بالفعل وجاهز للاستخدام!")
        return

    if not email:
        email = input("[?] يرجى إدخال بريد فيسبوك: ").strip()
    if not password:
        import getpass
        password = getpass.getpass("[?] يرجى إدخال كلمة المرور: ").strip()

    print(f"\n[+] محاولة تسجيل الدخول بالحساب...")
    try:
        # Fill email
        email_field = page.locator('#email, input[name="email"]').first
        if email_field.is_visible(timeout=3000):
            email_field.fill(email)
            time.sleep(0.8)

        # Fill password (try primary password)
        pass_field = page.locator('#pass, input[name="pass"]').first
        if pass_field.is_visible(timeout=3000):
            pass_field.fill(password)
            time.sleep(0.8)

        # Submit
        login_btn = page.locator('button[name="login"], #loginbutton, button[type="submit"]').first
        if login_btn.is_visible(timeout=2000):
            login_btn.click()
        else:
            page.keyboard.press("Enter")

        print("[+] تم إرسال بيانات الدخول، جاري انتظار استجابة فيسبوك...")
        time.sleep(5)
        dismiss_cookie_popups(page)

    except Exception as e:
        print(f"[!] ملاحظة أثناء محاولة الملء التلقائي: {e}")

    # Check if login succeeded or if user intervention is required
    if is_authenticated(context):
        print("[✓] تم تسجيل الدخول بنجاح تام!")
        return

    # Check if Facebook shows wrong password or error
    error_texts = []
    for sel in ['div[role="alert"]', '#error_box', '.login_error_box', '_9ay7']:
        try:
            loc = page.locator(sel).first
            if loc.is_visible(timeout=1000):
                txt = loc.inner_text().strip()
                if txt:
                    error_texts.append(txt)
        except Exception:
            pass

    print("\n" + "="*75)
    if error_texts:
        print(f"⚠️ رسالة فيسبوك: {error_texts[0]}")
    else:
        print("⚠️ لم يتم إتمام تسجيل الدخول تلقائياً (قد يتطلب فيسبوك كود تحقق 2FA أو تصحيح كلمة المرور).")

    print("\n👉 نافذة المتصفح مفتوحة أمامك الآن على شاشة الكمبيوتر:")
    print("   1. يمكنك مراجعة كتابة الإيميل والباسورد أو إدخال كود الأمان داخل نافذة المتصفح مباشرة.")
    print("   2. بمجرد تسجيل الدخول وظهور صفحة فيسبوك، سيكتشف الاسكربت ذلك تلقائياً ويكمل العمل فوراً!")
    print("="*75)

    # Live polling until user finishes login
    print("[*] بانتظار إتمام تسجيل الدخول داخل المتصفح...", end="", flush=True)
    wait_time = 0
    max_wait = 300 # wait up to 5 minutes
    while wait_time < max_wait:
        if is_authenticated(context):
            print("\n[✓] رائع! تم التحقق من نجاح تسجيل الدخول وحفظ الجلسة!")
            time.sleep(2)
            return
        time.sleep(2)
        wait_time += 2
        print(".", end="", flush=True)

    print("\n[!] انتهى وقت الانتظار. سيستمر الاسكربت في محاولة سحب الصور المتاحة.")


def collect_images_from_page(page, context, target_url, output_dir, max_scrolls=60):
    """Visits page sections, scrolls continuously, intercepts and downloads photos."""
    os.makedirs(output_dir, exist_ok=True)
    captured_urls = set()
    downloaded_hashes = set()

    # Pre-index existing files to avoid re-downloading
    for f in os.listdir(output_dir):
        fp = os.path.join(output_dir, f)
        if os.path.isfile(fp) and f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            try:
                with open(fp, 'rb') as img_f:
                    downloaded_hashes.add(hashlib.md5(img_f.read()).hexdigest())
            except Exception:
                pass

    print(f"[+] الصور الموجودة مسبقاً في المجلد: {len(downloaded_hashes)} صورة")

    # Hook network responses to catch full-res images directly from CDN
    def handle_response(response):
        try:
            url = response.url
            content_type = response.headers.get("content-type", "")
            if ("image" in content_type or ".fbcdn.net" in url) and is_likely_content_photo(url):
                if not any(size_tag in url for size_tag in ["/p50x50/", "/s50x50/", "/p32x32/", "/s32x32/", "/p100x100/"]):
                    captured_urls.add(url)
        except Exception:
            pass

    page.on("response", handle_response)

    # Sections to visit for comprehensive photo scraping
    urls_to_visit = [
        target_url,
        "https://www.facebook.com/100090709554990/photos",
        "https://www.facebook.com/100090709554990/photos_by",
        "https://www.facebook.com/100090709554990/photos_albums"
    ]

    for section_url in urls_to_visit:
        print("\n" + "-"*65)
        print(f"[+] جاري تصفح وسحب الصور من: {section_url}")
        print("-"*65)
        try:
            page.goto(section_url, wait_until="domcontentloaded", timeout=60000)
            time.sleep(3)
        except Exception as e:
            print(f"[!] ملاحظة عند فتح {section_url}: {e}")
            continue

        last_height = 0
        consecutive_no_change = 0

        for scroll_idx in range(1, max_scrolls + 1):
            try:
                img_elements = page.eval_on_selector_all(
                    'img',
                    '''elements => elements.map(el => ({
                        src: el.src,
                        currentSrc: el.currentSrc,
                        srcset: el.srcset,
                        width: el.naturalWidth || el.width,
                        height: el.naturalHeight || el.height
                    }))'''
                )
                for item in img_elements:
                    for src in [item.get('src'), item.get('currentSrc')]:
                        if src and is_likely_content_photo(src):
                            w = item.get('width', 0)
                            h = item.get('height', 0)
                            if w >= 150 or h >= 150 or (w == 0 and h == 0):
                                captured_urls.add(src)

                    srcset = item.get('srcset')
                    if srcset:
                        parts = [p.strip().split(' ') for p in srcset.split(',') if p.strip()]
                        for part in parts:
                            if len(part) > 0 and is_likely_content_photo(part[0]):
                                captured_urls.add(part[0])

            except Exception:
                pass

            # Scroll smoothly
            page.evaluate("window.scrollBy(0, 1200);")
            time.sleep(1.8)

            current_height = page.evaluate("document.body.scrollHeight")
            print(f"  [تمرير {scroll_idx}/{max_scrolls}] - تم رصد {len(captured_urls)} رابط صورة حتى الآن...", end="\r")

            if current_height == last_height:
                consecutive_no_change += 1
                if consecutive_no_change >= 4:
                    print(f"\n[✓] تم الوصول لنهاية محتوى هذا القسم.")
                    break
            else:
                consecutive_no_change = 0
                last_height = current_height

        print(f"\n[+] إجمالي روابط الصور الملتقطة بعد القسم: {len(captured_urls)}")

    # Download high-res images
    print("\n" + "="*65)
    print(f"[+] بدء تحميل الصور وفحص دقتها وجودتها في المجلد: '{output_dir}'...")
    print("="*65)

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
            if res.status_code != 200 or len(res.content) < 15000:
                continue

            # Check dimensions with PIL
            try:
                img_io = BytesIO(res.content)
                img = Image.open(img_io)
                width, height = img.size

                if width < 220 and height < 220:
                    continue

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
                print(f"[{counter-1}] تم حفظ صورة: {filename} ({width}x{height} بكسل - {len(res.content)//1024} KB)")

            except Exception:
                continue

        except Exception:
            continue

    print("\n" + "="*65)
    print(f"[✓] اكتملت المهمة!")
    print(f"  • صور جديدة تم تحميلها: {new_saved}")
    print(f"  • إجمالي الصور في المجلد '{output_dir}': {len(downloaded_hashes)}")
    print(f"  • مسار المجلد: {os.path.abspath(output_dir)}")
    print("="*65)


def main():
    parser = argparse.ArgumentParser(description="Facebook Page Photos Downloader for Copy-Cat")
    parser.add_argument("--url", default=DEFAULT_PAGE_URL, help="Facebook page URL")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help="Facebook login email")
    parser.add_argument("--password", default=DEFAULT_PASSWORD_1, help="Facebook login password")
    parser.add_argument("--out", default=DEFAULT_OUTPUT_DIR, help="Output folder for images")
    parser.add_argument("--scrolls", type=int, default=50, help="Max scrolls per section")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")

    args = parser.parse_args()

    print("="*75)
    print("  🚀 Copy-Cat Facebook Photos Downloader | أداة سحب صور فيسبوك")
    print("="*75)
    print(f"• الصفحة المستهدفة: {args.url}")
    print(f"• الحساب: {args.email}")
    print(f"• مجلد الحفظ: {os.path.abspath(args.out)}")
    print("="*75)

    with sync_playwright() as playwright:
        context = setup_browser(playwright, headless=args.headless)
        page = context.new_page()

        try:
            check_and_login(page, context, args.email, args.password)
            collect_images_from_page(page, context, args.url, args.out, max_scrolls=args.scrolls)
        finally:
            print("[+] جاري حفظ الجلسة وإغلاق المتصفح...")
            context.close()


if __name__ == "__main__":
    main()
