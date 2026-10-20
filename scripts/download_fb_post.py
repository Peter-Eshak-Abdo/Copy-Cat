import os
import sys
import time
import json
import argparse
import re
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image
from io import BytesIO
from playwright.sync_api import sync_playwright

USER_DATA_DIR = "fb_profile"


def log_json(msg_type: str, data: dict):
    payload = {"type": msg_type, **data}
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def is_valid_photo_url(url: str) -> bool:
    if not url:
        return False
    u = url.lower()
    if any(bad in u for bad in ["rsrc.php", "emoji.php", "static.xx", "favicon", "/badges/", "/icons/"]):
        return False
    return "fbcdn.net" in u or "facebook.com" in u


def sanitize_filename(name: str) -> str:
    return re.sub(r'[\\/*?:"<>|]', "_", name).strip()


def download_image(url: str, output_path: str, cookies_dict: dict = None) -> bool:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/128.0.0.0 Safari/537.36"
        ),
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": "https://www.facebook.com/",
    }
    try:
        resp = requests.get(url, headers=headers, cookies=cookies_dict, timeout=25)
        if resp.status_code == 200 and len(resp.content) > 3000:
            with open(output_path, "wb") as f:
                f.write(resp.content)
            return True
    except Exception as e:
        log_json("log", {"level": "warn", "message": f"Failed to download image {url[:60]}: {e}"})
    return False


def compile_images_to_pdf(image_paths: list[str], output_pdf: str) -> bool:
    if not image_paths:
        return False
    try:
        pil_images = []
        for img_path in image_paths:
            try:
                im = Image.open(img_path)
                if im.mode in ("RGBA", "P", "LA"):
                    bg = Image.new("RGB", im.size, (255, 255, 255))
                    if im.mode == "RGBA":
                        bg.paste(im, mask=im.split()[3])
                    else:
                        bg.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[3])
                    pil_images.append(bg)
                elif im.mode != "RGB":
                    pil_images.append(im.convert("RGB"))
                else:
                    pil_images.append(im)
            except Exception as ex:
                log_json("log", {"level": "warn", "message": f"Skipping corrupt image {img_path}: {ex}"})

        if not pil_images:
            return False

        os.makedirs(os.path.dirname(os.path.abspath(output_pdf)), exist_ok=True)
        first_img = pil_images[0]
        other_imgs = pil_images[1:] if len(pil_images) > 1 else []
        first_img.save(output_pdf, save_all=True, append_images=other_imgs, resolution=150.0, quality=90)
        return True
    except Exception as e:
        log_json("error", {"message": f"PDF compilation error: {e}"})
        return False


def scrape_post_images(post_url: str, output_dir: str, pdf_name: str, max_photos: int = 150, headless: bool = True):
    log_json("status", {"message": "جاري تشغيل المتصفح والدخول بحساب فيس بوك..."})

    profile_path = os.path.abspath(USER_DATA_DIR)
    os.makedirs(profile_path, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    with sync_playwright() as p:
        browser_context = p.chromium.launch_persistent_context(
            user_data_dir=profile_path,
            headless=headless,
            viewport={"width": 1280, "height": 850},
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )

        page = browser_context.pages[0] if browser_context.pages else browser_context.new_page()

        log_json("status", {"message": f"جاري فتح الرابط: {post_url}..."})
        try:
            page.goto(post_url, wait_until="domcontentloaded", timeout=45000)
            time.sleep(3)
        except Exception as e:
            log_json("error", {"message": f"تعذر فتح الرابط: {e}"})
            browser_context.close()
            return

        # Check if login or cookie consent is requested
        try:
            decline_btns = page.query_selector_all('button[aria-label*="Decline"], button[aria-label*="رفض"]')
            if decline_btns:
                decline_btns[0].click()
                time.sleep(1)
        except:
            pass

        log_json("status", {"message": "جاري تحليل المنشور والبحث عن الصور..."})

        # Determine if we're already in theatre mode or need to click first photo
        is_theatre = "/photo" in page.url or "theater" in page.url or "fbid=" in page.url

        if not is_theatre:
            post_id_match = re.search(r'/(?:permalink|posts|story_fbid)/(\d+)', post_url) or re.search(r'[?&](?:fbid|id|story_fbid)=(\d+)', post_url)
            target_post_id = post_id_match.group(1) if post_id_match else None

            # Find photo links specific to this post
            all_links = page.query_selector_all('a[href*="/photo"], a[href*="photo.php"]')
            target_link = None
            if target_post_id:
                for l in all_links:
                    href = l.get_attribute("href") or ""
                    if target_post_id in href or "set=pcb" in href:
                        target_link = l
                        break

            if not target_link and all_links:
                target_link = all_links[0]

            if target_link:
                log_json("status", {"message": "تم العثور على ألبوم/صور المنشور، جاري الدخول لوضع العرض الكامل..."})
                try:
                    target_link.click()
                    time.sleep(3.5)
                except:
                    pass

        # We will collect high-res URLs in exact sequential order
        collected_urls: list[str] = []
        seen_urls = set()
        stagnant_count = 0

        # Extract browser cookies for requests
        cookies = browser_context.cookies()
        cookies_dict = {c["name"]: c["value"] for c in cookies}

        log_json("status", {"message": "جاري تتبع وتقليب صور المنشور بالترتيب..."})

        for step in range(max_photos):
            # Attempt to find the main high-res photo in theatre view
            img_candidates = page.query_selector_all(
                'div[role="dialog"] img[src*="fbcdn"], '
                'div[role="main"] img[src*="fbcdn"], '
                'img[data-visualcompletion="media-vc-image"], '
                'div[data-pagelet="MediaViewerRoot"] img'
            )

            found_src = None
            max_area = 0

            for img in img_candidates:
                try:
                    src = img.get_attribute("src")
                    if src and is_valid_photo_url(src):
                        box = img.bounding_box()
                        area = (box["width"] * box["height"]) if box else 0
                        if area > max_area:
                            max_area = area
                            found_src = src
                except:
                    continue

            # Fallback if no theatre image found: grab largest image on page
            if not found_src:
                all_imgs = page.query_selector_all('img[src*="fbcdn"]')
                for img in all_imgs:
                    src = img.get_attribute("src")
                    if src and is_valid_photo_url(src):
                        box = img.bounding_box()
                        area = (box["width"] * box["height"]) if box else 0
                        if area > max_area and area > 10000:
                            max_area = area
                            found_src = src

            if found_src:
                base_key = found_src.split("?")[0]
                # Deduplicate by base URL
                if base_key not in seen_urls:
                    seen_urls.add(base_key)
                    collected_urls.append(found_src)
                    stagnant_count = 0
                    log_json("progress", {
                        "current": len(collected_urls),
                        "message": f"تم اكتشاف صورة رقم {len(collected_urls)}...",
                        "image_url": found_src,
                    })
                else:
                    stagnant_count += 1
            else:
                stagnant_count += 1

            # Try clicking Next photo button in theatre overlay, thumbnail tray, or keyboard navigation
            clicked = False
            next_btn = page.query_selector(
                'div[aria-label="Next photo"], '
                'div[aria-label="الصورة التالية"], '
                'div[aria-label="صورة تالية"], '
                'div[aria-label*="Next"], '
                'div[aria-label*="التالية"], '
                'div[role="button"][aria-label*="التالية"], '
                'div[role="button"][aria-label*="Next"], '
                'div[data-visualcompletion="ignore-dynamic-extra"] div[role="button"]'
            )
            if next_btn:
                try:
                    next_btn.click(timeout=1500)
                    clicked = True
                    time.sleep(1.2)
                except:
                    pass

            # In Arabic Facebook layouts, ArrowLeft moves to the NEXT photo (RTL)
            if not clicked:
                try:
                    page.keyboard.press("ArrowLeft")
                    time.sleep(0.8)
                    # Also try ArrowRight as fallback
                    page.keyboard.press("ArrowRight")
                    time.sleep(0.8)
                except:
                    pass

            # Also check if there are clickable thumbnail gallery items in theater tray
            if stagnant_count >= 2:
                try:
                    tray_thumbs = page.query_selector_all('div[data-pagelet="MediaViewerRoot"] [role="list"] a, div[role="dialog"] a[href*="/photo"], div[role="tablist"] [role="tab"]')
                    if tray_thumbs and len(tray_thumbs) > len(collected_urls):
                        target_thumb = tray_thumbs[len(collected_urls)]
                        target_thumb.click(timeout=1500)
                        time.sleep(1.2)
                except:
                    pass

            if stagnant_count >= 8:
                log_json("status", {"message": f"تم استخراج جميع صور المنشور بنجاح ({len(collected_urls)} صورة)."})
                break

        browser_context.close()

        if not collected_urls:
            log_json("error", {"message": "لم يتم العثور على صور في الرابط المحدد. يرجى التحقق من خصوصية المنشور أو الرابط."})
            return

        # Download all photos sequentially
        log_json("status", {"message": f"جاري تحميل {len(collected_urls)} صورة بأعلى دقة متوفرة..."})

        downloaded_files: list[str] = []
        for idx, img_url in enumerate(collected_urls, start=1):
            file_name = f"page_{idx:03d}.jpg"
            file_path = os.path.join(output_dir, file_name)

            ok = download_image(img_url, file_path, cookies_dict)
            if ok:
                downloaded_files.append(file_path)
                log_json("download_progress", {
                    "downloaded": len(downloaded_files),
                    "total": len(collected_urls),
                    "file_name": file_name,
                    "rel_url": f"{output_dir.replace('public/', '/')}/{file_name}".replace("\\", "/"),
                })

        if not downloaded_files:
            log_json("error", {"message": "فشل تحميل الصور من خوادم فيس بوك."})
            return

        # Compile into PDF
        pdf_filename = sanitize_filename(pdf_name)
        if not pdf_filename.endswith(".pdf"):
            pdf_filename += ".pdf"

        pdf_full_path = os.path.join(output_dir, pdf_filename)
        log_json("status", {"message": f"جاري دمج الـ {len(downloaded_files)} صورة في ملف PDF فائق الجودة للطباعة..."})

        success = compile_images_to_pdf(downloaded_files, pdf_full_path)

        if success:
            web_pdf_url = f"{output_dir.replace('public/', '/')}/{pdf_filename}".replace("\\", "/")
            if not web_pdf_url.startswith("/"):
                web_pdf_url = "/" + web_pdf_url

            rel_images = [
                f"{output_dir.replace('public/', '/')}/{os.path.basename(f)}".replace("\\", "/")
                for f in downloaded_files
            ]

            log_json("completed", {
                "total_images": len(downloaded_files),
                "pdf_url": web_pdf_url,
                "pdf_filename": pdf_filename,
                "pdf_path": pdf_full_path,
                "images": rel_images,
                "message": f"تم سحب ودمج {len(downloaded_files)} صورة بنجاح في ملف PDF جاهز للطباعة فوراً!",
            })
        else:
            log_json("error", {"message": "حدث خطأ أثناء تجميع ملف الـ PDF."})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Facebook Post Bulk Image & PDF Downloader")
    parser.add_argument("--url", required=True, help="Facebook post or album URL")
    parser.add_argument("--out-dir", default="public/uploads/fb_posts/post_doc", help="Output directory")
    parser.add_argument("--pdf-name", default="ملزمة_فيسبوك.pdf", help="Output PDF name")
    parser.add_argument("--max", type=int, default=150, help="Max photos to scrape")
    parser.add_argument("--headed", action="store_true", help="Run browser with GUI")

    args = parser.parse_args()

    scrape_post_images(
        post_url=args.url,
        output_dir=args.out_dir,
        pdf_name=args.pdf_name,
        max_photos=args.max,
        headless=not args.headed,
    )
