/**
 * Source of the Facebook browser helper (bookmarklet). Build it into lib/fb-bookmarklet.ts with:
 *   node scripts/build-fb-bookmarklet.mjs
 *
 * Browser helper ("bookmarklet") for Facebook posts the server cannot open (closed groups, private posts).
 * It runs in the shop's own Chrome tab, where the staff member is already logged in, so it only sees what
 * that account can see. With a post's photo viewer open it reads the big photo, presses "next" until it
 * comes back to the first photo, and shows the collected image links in a box with a copy button. The
 * links (Facebook's image CDN) are pasted into the PDF page, which downloads them in order.
 */
(function helper() {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const overlay = (html: string) => {
    let box = document.getElementById("copycat-fb-helper");
    if (!box) {
      box = document.createElement("div");
      box.id = "copycat-fb-helper";
      box.setAttribute(
        "style",
        "position:fixed;z-index:2147483647;top:16px;left:50%;transform:translateX(-50%);width:min(520px,92vw);" +
          "background:#fff;color:#0f172a;border:2px solid #2563eb;border-radius:16px;padding:16px;" +
          "font:14px/1.6 Arial,sans-serif;direction:rtl;box-shadow:0 20px 50px rgba(0,0,0,.35)"
      );
      document.body.appendChild(box);
    }
    box.innerHTML = html;
    return box;
  };
  // The photo being shown: the largest Facebook-CDN image on the page
  const current = () => {
    const imgs = Array.from(document.querySelectorAll("img")).filter(
      (i) => /fbcdn\.net/.test(i.src) && i.naturalWidth >= 300 && i.getBoundingClientRect().width > 150
    );
    imgs.sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight);
    return imgs[0] ? imgs[0].src : "";
  };
  const next = () => {
    const labels = ["Next photo", "الصورة التالية", "Next", "التالي"];
    for (const l of labels) {
      const b = document.querySelector(`[aria-label="${l}"]`) as HTMLElement | null;
      if (b) {
        b.click();
        return;
      }
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", keyCode: 39, bubbles: true }));
  };

  (async () => {
    const first = current();
    if (!first) {
      overlay(
        "<b>افتح أول صورة في البوست الأول</b><br>دوس على أول صورة في البوست عشان تفتح كبيرة، وبعدين دوس الزرار تاني."
      );
      return;
    }
    const urls: string[] = [];
    const key = (u: string) => u.split("?")[0];
    for (let i = 0; i < 300; i++) {
      const u = current();
      if (u && !urls.some((x) => key(x) === key(u))) urls.push(u);
      overlay(`<b>بنجمع الصور... ${urls.length}</b><br>سيب الصفحة لحد ما يخلص.`);
      next();
      // Wait for a different photo to show (a slow line can take seconds; meanwhile no photo is shown at all)
      let waited = 0;
      let now = current();
      while ((!now || key(now) === key(u)) && waited < 100) {
        await sleep(150);
        waited++;
        now = current();
      }
      // "next" did nothing, or the viewer is back at the first photo: every photo of the post is collected
      if (!now || key(now) === key(u) || key(now) === key(first)) break;
    }
    const text = urls.join("\n");
    const box = overlay(
      `<b>لقينا ${urls.length} صورة ✓</b><br>دوس «انسخ»، وارجع لصفحة كوبي كات والزقهم في خانة الروابط.` +
        '<textarea readonly style="width:100%;height:90px;margin:10px 0;font:11px monospace;direction:ltr"></textarea>' +
        '<button id="cc-copy" style="background:#2563eb;color:#fff;border:0;border-radius:10px;padding:8px 18px;font-weight:bold;cursor:pointer">انسخ</button> ' +
        '<button id="cc-close" style="background:#e2e8f0;border:0;border-radius:10px;padding:8px 14px;cursor:pointer">اقفل</button>'
    );
    const area = box.querySelector("textarea") as HTMLTextAreaElement;
    area.value = text;
    (box.querySelector("#cc-copy") as HTMLElement).onclick = async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        area.select();
        document.execCommand("copy");
      }
      (box.querySelector("#cc-copy") as HTMLElement).textContent = "اتنسخ ✓";
    };
    (box.querySelector("#cc-close") as HTMLElement).onclick = () => box.remove();
  })();
})();
