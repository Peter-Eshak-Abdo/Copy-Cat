import os
import sys
import time
import json
import argparse
import re
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor

import requests
from PIL import Image
from playwright.sync_api import sync_playwright

USER_DATA_DIR = "fb_profile"


def log_json(msg_type: str, data: dict):
    payload = {"type": msg_type, **data}
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def is_valid_photo_url(url: str) -> bool:
    if not url:
        return False
    u = url.lower()
    if any(bad in u for bad in [
        "rsrc.php", "emoji.php", "static.xx", "favicon", "/badges/", "/icons/",
        "s150x150", "p50x50", "p100x100", "s50x50", "p32x32", "cp0"
    ]):
        return False
    return "fbcdn.net" in u or "facebook.com" in u


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r'[\\/*?:"<>|]', "_", name).strip()
    return cleaned if cleaned else "ملزمة_فيسبوك"


def download_single_image(args_tuple) -> tuple[int, str | None]:
    idx, img_url, file_path, cookies_dict = args_tuple
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/130.0.0.0 Safari/537.36"
        ),
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": "https://www.facebook.com/",
    }
    for attempt in range(2):
        try:
            resp = requests.get(img_url, headers=headers, cookies=cookies_dict, timeout=30)
            if resp.status_code == 200 and len(resp.content) > 3000:
                with open(file_path, "wb") as f:
                    f.write(resp.content)
                return idx, file_path
        except Exception as e:
            if attempt == 1:
                log_json("log", {"level": "warn", "message": f"تعذر تحميل الصورة {idx}: {e}"})
            time.sleep(1)
    return idx, None


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
                log_json("log", {"level": "warn", "message": f"تخطي صورة غير صالحة {img_path}: {ex}"})

        if not pil_images:
            return False

        os.makedirs(os.path.dirname(os.path.abspath(output_pdf)), exist_ok=True)
        first_img = pil_images[0]
        other_imgs = pil_images[1:] if len(pil_images) > 1 else []
        first_img.save(output_pdf, save_all=True, append_images=other_imgs, resolution=150.0, quality=90)
        return True
    except Exception as e:
        log_json("error", {"message": f"خطأ في تجميع الـ PDF: {e}"})
        return False


def extract_post_identifiers(url: str) -> dict:
    ids = {
        "pfbid": None,
        "story_fbid": None,
        "post_id": None,
        "fbid": None,
        "pcb_id": None,
        "author_slug": None,
    }
    if not url:
        return ids

    pfbid_m = re.search(r'pfbid[a-zA-Z0-9]+', url)
    if pfbid_m:
        ids["pfbid"] = pfbid_m.group(0)

    story_m = re.search(r'story_fbid=([a-zA-Z0-9]+)', url)
    if story_m:
        ids["story_fbid"] = story_m.group(1)

    post_m = (
        re.search(r'/(?:permalink|posts)/([a-zA-Z0-9]+)', url) or
        re.search(r'/groups/[^/]+/posts/([a-zA-Z0-9]+)', url)
    )
    if post_m:
        ids["post_id"] = post_m.group(1)

    fbid_m = re.search(r'[?&](?:fbid|id)=([a-zA-Z0-9]+)', url)
    if fbid_m:
        ids["fbid"] = fbid_m.group(1)

    pcb_m = re.search(r'set=pcb\.([a-zA-Z0-9]+)', url)
    if pcb_m:
        ids["pcb_id"] = pcb_m.group(1)

    auth_m = re.search(r'facebook\.com/([^/?#]+)/(?:posts|photos)', url)
    if auth_m:
        cand = auth_m.group(1)
        if cand not in ("share", "photo", "groups", "pages", "watch", "media", "story.php", "permalink.php"):
            ids["author_slug"] = cand

    return ids


def scrape_post_images(post_url: str, output_dir: str, pdf_name: str, max_photos: int = 150, headless: bool = True):
    log_json("status", {"message": "جاري تشغيل محرك فيسبوك المتطور وقراءة المنشور..."})

    profile_path = os.path.abspath(USER_DATA_DIR)
    os.makedirs(profile_path, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    with sync_playwright() as p:
        browser_context = p.chromium.launch_persistent_context(
            user_data_dir=profile_path,
            headless=headless,
            viewport={"width": 1400, "height": 900},
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
            time.sleep(3.5)
        except Exception as e:
            log_json("error", {"message": f"تعذر فتح الرابط: {e}"})
            browser_context.close()
            return

        # Dismiss any cookie banner or dialogs
        try:
            decline_btns = page.query_selector_all('button[aria-label*="Decline"], button[aria-label*="رفض"]')
            if decline_btns:
                decline_btns[0].click()
                time.sleep(1)
        except:
            pass

        current_url = page.url
        log_json("log", {"level": "info", "message": f"عنوان الصفحة المستقر: {current_url}"})

        # Combine clues from original post URL and settled redirected URL
        initial_ids = extract_post_identifiers(post_url)
        settled_ids = extract_post_identifiers(current_url)

        target_pfbid = settled_ids["pfbid"] or initial_ids["pfbid"]
        target_post_id = settled_ids["post_id"] or initial_ids["post_id"] or settled_ids["story_fbid"] or initial_ids["story_fbid"]
        target_pcb_id = settled_ids["pcb_id"] or initial_ids["pcb_id"]
        target_author = settled_ids["author_slug"] or initial_ids["author_slug"]

        is_theatre = (
            ("/photo/" in current_url or "/photo.php" in current_url or "theater" in current_url) and
            "story_fbid" not in current_url and
            "story.php" not in current_url and
            "permalink.php" not in current_url
        )

        detected_post_title = None

        if not is_theatre:
            log_json("status", {"message": "جاري العثور على ألبوم صور المنشور الأصلي..."})
            target_link_href = None
            target_article_elem = None

            # Scan all articles to pinpoint the EXACT one matching the target post
            articles = page.query_selector_all('div[role="article"]')

            for art in articles:
                try:
                    art_links = [a.get_attribute("href") or "" for a in art.query_selector_all("a")]
                    matches = False

                    if target_pfbid and any(target_pfbid in h for h in art_links):
                        matches = True
                    elif target_post_id and any(target_post_id in h for h in art_links):
                        matches = True
                    elif target_pcb_id and any(f"pcb.{target_pcb_id}" in h for h in art_links):
                        matches = True
                    elif target_author and any(f"/{target_author}/" in h for h in art_links) and any("set=pcb." in h or "/photo" in h for h in art_links):
                        matches = True

                    if matches:
                        # Extract photo links from this specific article
                        pcb_links = [h for h in art_links if "set=pcb." in h]
                        photo_links = [h for h in art_links if "/photo" in h or "photo.php" in h]

                        if pcb_links:
                            target_link_href = pcb_links[0]
                            target_article_elem = art
                            break
                        elif photo_links:
                            target_link_href = photo_links[0]
                            target_article_elem = art
                            break
                except Exception:
                    continue

            # Fallback 1: Direct target PCB or post photo links on the whole page
            if not target_link_href and target_pcb_id:
                pcb_links = page.query_selector_all(f'a[href*="set=pcb.{target_pcb_id}"]')
                if pcb_links:
                    target_link_href = pcb_links[0].get_attribute("href")

            if not target_link_href and target_post_id:
                pcb_links = page.query_selector_all(f'a[href*="set=pcb.{target_post_id}"]')
                if pcb_links:
                    target_link_href = pcb_links[0].get_attribute("href")
                else:
                    post_photo_links = page.query_selector_all(f'a[href*="{target_post_id}"][href*="photo"]')
                    if post_photo_links:
                        target_link_href = post_photo_links[0].get_attribute("href")

            # Fallback 2: Album set links (set=a.)
            if not target_link_href:
                album_links = page.query_selector_all('a[href*="set=a."]')
                if album_links:
                    target_link_href = album_links[0].get_attribute("href")

            # Fallback 3: Check inside div[role="main"]
            if not target_link_href:
                main_elem = page.query_selector('div[role="main"]')
                if main_elem:
                    main_photos = main_elem.query_selector_all('a[href*="set=pcb."], a[href*="/photo"]')
                    if main_photos:
                        target_link_href = main_photos[0].get_attribute("href")

            # Extract smart title from target article or page title
            try:
                if target_article_elem:
                    art_text = target_article_elem.inner_text() or ""
                    lines = [ln.strip() for ln in art_text.split("\n") if ln.strip()]
                    for ln in lines:
                        if len(ln) > 6 and not any(skip in ln for skip in ["أعجبني", "تعليق", "مشاركة", "·", "ساعة", "دقيقة", "أمس", "رد"]):
                            detected_post_title = ln[:60]
                            break
                if not detected_post_title:
                    raw_title = page.title()
                    # Strip notification badges like "(20+) " and " | Facebook"
                    clean_title = re.sub(r'^\(\d+\+?\)\s*', '', raw_title)
                    clean_title = re.sub(r'\s*\|\s*Facebook.*$', '', clean_title).strip()
                    if clean_title and len(clean_title) > 3:
                        detected_post_title = clean_title[:60]
            except Exception:
                pass

            if target_link_href:
                if target_link_href.startswith("/"):
                    target_link_href = "https://www.facebook.com" + target_link_href
                log_json("status", {"message": "تم العثور على ألبوم صور المنشور الأصلي بنجاح! جاري الدخول لوضع العرض الكامل..."})
                try:
                    page.goto(target_link_href, wait_until="domcontentloaded", timeout=30000)
                    time.sleep(3.0)
                except Exception as ex:
                    log_json("log", {"level": "warn", "message": f"Navigation to photo link failed: {ex}"})
            else:
                log_json("log", {"level": "warn", "message": "لم يتم العثور على رابط ألبوم محدد، محاولة البحث عن الصور داخل العرض الحالي..."})

        collected_urls: list[str] = []
        seen_base_urls = set()
        stagnant_count = 0
        first_fbid = None

        cookies = browser_context.cookies()
        cookies_dict = {c["name"]: c["value"] for c in cookies}

        log_json("status", {"message": "جاري تتبع وتقليب صور الملزمة بالترتيب وبأعلى دقة..."})

        for step in range(max_photos):
            # Extract fbid from current theatre URL
            fbid_match = re.search(r'[?&]fbid=(\d+)', page.url)
            curr_fbid = fbid_match.group(1) if fbid_match else None

            if curr_fbid:
                if first_fbid is None:
                    first_fbid = curr_fbid
                elif curr_fbid == first_fbid and len(collected_urls) > 3:
                    log_json("status", {"message": f"تم استعراض ألبوم الصور بالكامل والعودة للبداية بنجاح! ({len(collected_urls)} صورة)"})
                    break

            # Find main theatre image
            img_candidates = page.query_selector_all(
                'div[data-pagelet="MediaViewerRoot"] img, '
                'div[role="main"] img, '
                'img[data-visualcompletion="media-vc-image"], '
                'div[role="dialog"] img'
            )

            found_src = None
            max_area = 0

            for img in img_candidates:
                try:
                    src = img.get_attribute("src")
                    if src and is_valid_photo_url(src):
                        box = img.bounding_box()
                        area = (box["width"] * box["height"]) if box else 0
                        if area > max_area and area > 35000:
                            max_area = area
                            found_src = src
                except:
                    continue

            # Fallback if specific selectors didn't match
            if not found_src:
                all_imgs = page.query_selector_all('img[src*="fbcdn"]')
                for img in all_imgs:
                    src = img.get_attribute("src")
                    if src and is_valid_photo_url(src):
                        box = img.bounding_box()
                        area = (box["width"] * box["height"]) if box else 0
                        if area > max_area and area > 20000:
                            max_area = area
                            found_src = src

            if found_src:
                base_key = found_src.split("?")[0]
                if base_key not in seen_base_urls:
                    seen_base_urls.add(base_key)
                    collected_urls.append(found_src)
                    stagnant_count = 0
                    log_json("progress", {
                        "current": len(collected_urls),
                        "message": f"تم استخراج صفحة/صورة {len(collected_urls)}...",
                        "image_url": found_src,
                    })
                else:
                    stagnant_count += 1
            else:
                stagnant_count += 1

            if stagnant_count >= 6:
                log_json("status", {"message": f"تم الانتهاء من جمع كافة صور المنشور المتاحة ({len(collected_urls)} صورة)."})
                break

            # Navigate to Next photo
            clicked = False
            next_btn = page.query_selector(
                'div[aria-label="الصورة التالية"], '
                'div[aria-label="Next photo"], '
                'div[aria-label="صورة تالية"], '
                'div[aria-label*="التالية"], '
                'div[aria-label*="Next"]'
            )
            if next_btn:
                try:
                    next_btn.click(timeout=1200)
                    clicked = True
                    time.sleep(1.0)
                except:
                    pass

            # Fallback keyboard navigation: in Arabic RTL layouts, ArrowLeft goes to next
            if not clicked:
                try:
                    page.keyboard.press("ArrowLeft")
                    time.sleep(1.0)
                except:
                    pass

        browser_context.close()

        if not collected_urls:
            log_json("error", {"message": "لم يتم العثور على صور في الرابط المحدد. يرجى التحقق من خصوصية المنشور أو الرابط."})
            return

        # Parallel high-speed download of all photos preserving exact order
        log_json("status", {"message": f"جاري تحميل {len(collected_urls)} صورة بأعلى دقة متوفرة..."})

        download_tasks = []
        for idx, img_url in enumerate(collected_urls, start=1):
            file_name = f"page_{idx:03d}.jpg"
            file_path = os.path.join(output_dir, file_name)
            download_tasks.append((idx, img_url, file_path, cookies_dict))

        downloaded_results = {}
        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = [executor.submit(download_single_image, task) for task in download_tasks]
            for fut in futures:
                idx, saved_path = fut.result()
                if saved_path:
                    downloaded_results[idx] = saved_path
                    norm_out = output_dir.replace("\\", "/")
                    file_name = os.path.basename(saved_path)
                    if "uploads/fb_posts/" in norm_out:
                        sub_path = norm_out[norm_out.find("uploads/fb_posts/"):]
                        rel_url = f"/{sub_path}/{file_name}".replace("//", "/")
                    else:
                        folder_name = os.path.basename(norm_out)
                        rel_url = f"/api/admin/fb-download?download=1&dir={folder_name}&file={file_name}"

                    log_json("download_progress", {
                        "downloaded": len(downloaded_results),
                        "total": len(collected_urls),
                        "file_name": file_name,
                        "rel_url": rel_url,
                    })

        # Sort downloaded files strictly by page number
        sorted_indices = sorted(downloaded_results.keys())
        downloaded_files = [downloaded_results[i] for i in sorted_indices]

        if not downloaded_files:
            log_json("error", {"message": "فشل تحميل الصور من خوادم فيس بوك."})
            return

        # Compile into PDF
        pdf_title = sanitize_filename(pdf_name)
        if not pdf_title.endswith(".pdf"):
            pdf_title += ".pdf"

        # If user left title default and we detected a real title, use detected title
        if ("ملزمة_فيسبوك" in pdf_title or "ملزمة فيسبوك" in pdf_title) and detected_post_title:
            clean_detected = sanitize_filename(detected_post_title)
            pdf_title = f"{clean_detected}.pdf"

        pdf_full_path = os.path.join(output_dir, pdf_title)
        log_json("status", {"message": f"جاري دمج الـ {len(downloaded_files)} صورة في ملف PDF فائق الجودة للطباعة..."})

        success = compile_images_to_pdf(downloaded_files, pdf_full_path)

        if success:
            norm_out = output_dir.replace("\\", "/")
            if "uploads/fb_posts/" in norm_out:
                sub_path = norm_out[norm_out.find("uploads/fb_posts/"):]
                web_pdf_url = f"/{sub_path}/{pdf_title}".replace("//", "/")
                rel_images = [
                    f"/{sub_path}/{os.path.basename(f)}".replace("//", "/")
                    for f in downloaded_files
                ]
            else:
                folder_name = os.path.basename(norm_out)
                web_pdf_url = f"/api/admin/fb-download?download=1&dir={folder_name}&file={pdf_title}"
                rel_images = [
                    f"/api/admin/fb-download?download=1&dir={folder_name}&file={os.path.basename(f)}"
                    for f in downloaded_files
                ]

            final_display_title = (detected_post_title or pdf_title.replace(".pdf", "")).replace("_", " ")

            log_json("completed", {
                "total_images": len(downloaded_files),
                "pdf_url": web_pdf_url,
                "pdf_filename": pdf_title,
                "pdf_path": pdf_full_path,
                "images": rel_images,
                "title": final_display_title,
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
