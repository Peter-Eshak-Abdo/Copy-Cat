<div className="flex flex-col w-full">
<div className="flex flex-col gap-space-lg w-full max-w-7xl mx-auto pb-space-3xl pt-space-sm">
<div className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-lg shadow-xl">
<div className="absolute -right-24 -top-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
<div className="absolute left-1/3 -bottom-24 w-64 h-64 bg-tertiary/10 rounded-full blur-2xl pointer-events-none"></div>
<div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
<div className="flex items-start gap-space-md">
<div className="p-space-sm rounded-xl bg-surface-container-high text-primary flex items-center justify-center shadow-inner">
<span className="material-symbols-outlined text-3xl">psychology</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-space-xs">
<span className="font-headline-md text-headline-md text-on-surface">الماسح الضوئي الذكي (Multi-Stage OCR)</span>
<span className="font-label-tag text-label-tag px-space-xs py-space-2xs rounded bg-primary/15 text-primary">v3.2 AI Vision</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-2xs max-w-3xl">
              استخراج نصوص الأوراق والملازم العربية على مرحلتين: استخراج بصري دقيق يتبعه تدقيق نحوي وإملائي فوري، ثم تصدير Word منسق جاهز للطباعة المباشرة.
            </p>
</div>
</div>
<div className="flex items-center gap-space-sm self-stretch md:self-auto">
<div className="hidden lg:flex items-center gap-space-xs px-space-sm py-space-xs rounded-xl bg-surface-container">
<span className="relative flex h-2 w-2">
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
<span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
</span>
<span className="font-label-code text-label-code text-on-surface-variant">زمن الاستجابة: ~1.4 ثانية</span>
</div>
<button className="flex items-center justify-center gap-space-xs px-space-md py-space-xs rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface transition-all shadow-md active:scale-95" id="upload-new-trigger" type="button">
<span className="material-symbols-outlined text-xl">refresh</span>
<span className="font-body-sm text-body-sm font-semibold">صورة جديدة</span>
</button>
</div>
</div>
</div>
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
<div className="lg:col-span-5 flex flex-col gap-space-lg">
<div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg">
<div className="flex items-center justify-between pb-space-sm">
<div className="flex items-center gap-space-xs">
<span className="material-symbols-outlined text-primary text-xl">image</span>
<span className="font-headline-sm text-headline-sm text-on-surface">صورة الورقة أو المستند</span>
</div>
<div className="flex items-center gap-space-2xs">
<span className="font-label-tag text-label-tag px-space-xs py-space-2xs rounded bg-surface-container-highest text-on-surface-variant font-label-code">A4 / 300 DPI</span>
<button className="p-space-2xs rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors" title="تكبير" type="button">
<span className="material-symbols-outlined text-lg">zoom_in</span>
</button>
</div>
</div>
<div className="relative rounded-lg bg-surface-container-lowest overflow-hidden flex items-center justify-center p-space-xs group">
<div className="relative w-full max-h-[460px] overflow-hidden rounded bg-surface-dim flex items-center justify-center">
<img className="w-full h-auto object-contain max-h-[440px] rounded transition-transform duration-300 group-hover:scale-105" data-alt="A clean, high resolution scanned Arabic exam paper with tabular layout, religious education questions, Islamic studies text printed clearly on crisp white document sheet, studio scan lighting, sharp dark-mode workbench background" id="source-document-image" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSJ0sU1z-0wfprVDhR0irykWmNeBb_s-FIMECRQ25JdGQqyTzGF1VbDv9t-U8PkN78pYPD3IDEYaCqEeTknRW8nWm4UGFae72cBOqId3apg5Q2zPM19iss9sgTjw7jJp37p_KnXBKdV9uWM4027ym2hjHNkX462JnZa5WZbJpl7hbCSwflv-4R-S0bD3NuO8tqEyeFET3cvDcXUn4LzItN657acjEYBtEUmFA2BjwzR0HC-6xzqhLrtQ" />
<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80 animate-pulse pointer-events-none"></div>
</div>
<div className="absolute top-space-sm left-space-sm flex items-center gap-space-2xs bg-surface-container-lowest/90 px-space-xs py-space-2xs rounded backdrop-blur">
<span className="w-2 h-2 rounded-full bg-tertiary"></span>
<span className="font-label-code text-label-code text-on-surface">تم رصد شبكة الجداول</span>
</div>
</div>
<button className="mt-space-md w-full flex items-center justify-center gap-space-xs py-space-sm px-space-md rounded-xl bg-primary-container hover:bg-primary text-on-primary-container font-semibold transition-all shadow-lg shadow-primary-container/20 active:scale-95" id="start-ocr-btn" type="button">
<span className="material-symbols-outlined text-xl">auto_fix_high</span>
<span className="font-body-md text-body-md font-semibold">بدء الاستخراج والتدقيق اللغوي</span>
</button>
</div>
<div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg">
<div className="flex items-center gap-space-xs pb-space-md">
<span className="material-symbols-outlined text-tertiary text-xl">hub</span>
<span className="font-headline-sm text-headline-sm text-on-surface">مراحل المعالجة الذكية</span>
</div>
<div className="flex flex-col gap-space-sm relative">
<div className="flex items-start gap-space-sm p-space-sm rounded-lg bg-surface-container/60 hover:bg-surface-container transition-colors">
<div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary font-label-code text-label-code flex-shrink-0 mt-0.5">
                1
              </div>
<div className="flex flex-col">
<div className="flex items-center gap-space-xs">
<span className="font-body-sm text-body-sm font-semibold text-on-surface">المرحلة الأولى: الاستخراج البصري (Vision OCR)</span>
<span className="font-label-tag text-label-tag px-space-2xs rounded bg-surface-container-highest text-primary">اكتمل 100%</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  استخراج الحروف والكلمات العربية بدقة بصرية متقدمة، مع فرز وتحديد بنية الجداول وقوائم الاختبارات.
                </p>
</div>
</div>
<div className="flex items-start gap-space-sm p-space-sm rounded-lg bg-surface-container/60 hover:bg-surface-container transition-colors">
<div className="flex items-center justify-center w-7 h-7 rounded-full bg-tertiary/20 text-tertiary font-label-code text-label-code flex-shrink-0 mt-0.5">
                2
              </div>
<div className="flex flex-col">
<div className="flex items-center gap-space-xs">
<span className="font-body-sm text-body-sm font-semibold text-on-surface">المرحلة الثانية: التدقيق السياقي والإملائي</span>
<span className="font-label-tag text-label-tag px-space-2xs rounded bg-surface-container-highest text-tertiary">نشط</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  تصحيح الكلمات غير المكتملة وعلامات الترقيم وتنسيق الفقرات القرآنية والأحاديث وفق المعاجم العربية.
                </p>
</div>
</div>
<div className="flex items-start gap-space-sm p-space-sm rounded-lg bg-surface-container/60 hover:bg-surface-container transition-colors">
<div className="flex items-center justify-center w-7 h-7 rounded-full bg-surface-container-highest text-on-surface-variant font-label-code text-label-code flex-shrink-0 mt-0.5">
                3
              </div>
<div className="flex flex-col">
<div className="flex items-center gap-space-xs">
<span className="font-body-sm text-body-sm font-semibold text-on-surface">المرحلة الثالثة: جاهز للنسخ والتصدير</span>
<span className="font-label-tag text-label-tag px-space-2xs rounded bg-surface-container-highest text-on-surface-variant font-label-code">A4 Print Ready</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  إنشاء ملف Word مقاس A4 بمسافات وهوامش ضيقة وخط 18pt مخصص لماكينات ريسو وكونيكا مينولتا.
                </p>
</div>
</div>
</div>
</div>
</div>
<div className="lg:col-span-7 flex flex-col gap-space-lg">
<div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg min-h-[640px]">
<div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-sm">
<div className="flex items-center gap-space-xs">
<span className="material-symbols-outlined text-primary text-xl">description</span>
<span className="font-headline-sm text-headline-sm text-on-surface">النص المستخرج والمدقق</span>
</div>
<div className="flex items-center gap-space-xs">
<button className="flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-colors active:scale-95" id="copy-text-btn" type="button">
<span className="material-symbols-outlined text-lg">content_copy</span>
<span className="font-body-sm text-body-sm font-semibold">نسخ النص</span>
</button>
<button className="flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-primary-container hover:bg-primary text-on-primary-container transition-colors shadow-md active:scale-95" id="export-docx-btn" type="button">
<span className="material-symbols-outlined text-lg">download</span>
<span className="font-body-sm text-body-sm font-semibold">تصدير Word (.docx)</span>
</button>
</div>
</div>
<div className="flex flex-col gap-space-2xs mb-space-sm">
<label className="font-label-tag text-label-tag text-on-surface-variant" htmlFor="document-title">
              عنوان المستند لملف Word:
            </label>
<div className="relative">
<input className="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md px-space-sm py-space-xs rounded-lg outline-none focus:bg-surface-container-high transition-all" id="document-title" type="text" value="مستند_نصوص_مستخرجة_مذكرة_دين_الصف_الثالث.docx" />
<span className="absolute left-space-sm top-2.5 font-label-code text-label-code text-on-surface-variant">DOCX</span>
</div>
</div>
<div className="flex-1 flex flex-col relative rounded-lg bg-surface-container-lowest p-space-sm">
<div className="flex items-center justify-between pb-space-xs px-space-xs text-on-surface-variant">
<div className="flex items-center gap-space-sm">
<span className="font-label-tag text-label-tag uppercase tracking-wider text-outline">المحرر المباشر</span>
<span className="font-label-code text-label-code text-primary">تم تطبيق التدقيق النحوي الآلي</span>
</div>
<div className="flex items-center gap-space-xs">
<span className="font-label-code text-label-code text-on-surface-variant">نمط العرض: RTL الطباعي</span>
</div>
</div>
<textarea className="w-full flex-1 bg-transparent text-on-surface font-body-md text-body-md leading-relaxed resize-y outline-none p-space-xs selection:bg-primary selection:text-on-primary" id="ocr-text-editor" placeholder="سيظهر النص المستخرج هنا تلقائياً، ويمكنك تعديله مباشرة قبل التصدير..." rows="15">بسم الله الرحمن الرحيم
إدارة: التربية والتعليم
مدرسة: الرباط الابتدائية
أسئلة امتحانات نهاية السنة للعام الدراسي (٢٠١٩ - ٢٠٢٠)
المادة: التربية الإسلامية | الصف: الثالث الابتدائي

[جدول الاختبار الموحد]
-----------------------------------------------------------------------------
١. السورة: الفلق | الآيات: (١) | التلاوة: قل أعوذ برب الفلق | المعنى: الصبح
٢. العقيدة والعبادات: من هو خاتم الأنبياء؟
الإجابة: محمد رسول الله (صلى الله عليه وسلم) وهو خاتم الأنبياء والمرسلين.
٣. السيرة النبوية: كم كان عمر النبي حين توفيت أمه؟
الإجابة: كان عمره ست سنوات، وتوفيت بالأبواء بين مكة والمدينة.
٤. الآداب الإسلامية: آداب الطريق وإماطة الأذى.
حديث شريف: «عن أبي هريرة رضي الله عنه قال: قال رسول الله صلى الله عليه وسلم: الإيمان بضع وسبعون أو بضع وستون شعبة، فأفضلها قول لا إله إلا الله، وأدناها إماطة الأذى عن الطريق».
-----------------------------------------------------------------------------
ملاحظة لغرفة الطباعة: يتم التجهيز على ورق أبيض وزن ٧٠ جرام - تسليم كلي لعدد ٤٥٠ نسخة ملزمة.</textarea>
</div>
<div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-md text-on-surface-variant font-label-code text-label-code">
<div className="flex items-center gap-space-md">
<div className="flex items-center gap-space-2xs">
<span className="material-symbols-outlined text-base">notes</span>
<span>عدد الكلمات: <strong className="text-on-surface" id="word-count">148</strong></span>
</div>
<div className="flex items-center gap-space-2xs">
<span className="material-symbols-outlined text-base">match_case</span>
<span>عدد الأحرف: <strong className="text-on-surface" id="char-count">892</strong></span>
</div>
</div>
<div className="flex items-center gap-space-md">
<div className="flex items-center gap-space-2xs">
<span className="material-symbols-outlined text-base text-primary">margin</span>
<span>المسافات: <strong>ضيقة (0.5 بوصة)</strong></span>
</div>
<div className="flex items-center gap-space-2xs">
<span className="material-symbols-outlined text-base text-tertiary">format_size</span>
<span>الخط الافتراضي: <strong>Traditional Arabic 18pt</strong></span>
</div>
</div>
</div>
</div>
</div>
</div>
<div className="flex flex-wrap items-center justify-between gap-space-md p-space-md rounded-xl bg-surface-container-low shadow-md">
<div className="flex items-center gap-space-sm">
<div className="p-space-xs rounded-lg bg-primary/20 text-primary">
<span className="material-symbols-outlined text-xl">cloud_done</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-space-xs">
<span className="font-body-sm text-body-sm font-semibold text-on-surface">خادم معالجة اللغة والنماذج البصرية متصل</span>
<span className="w-2 h-2 rounded-full bg-primary"></span>
</div>
<span className="font-label-code text-label-code text-on-surface-variant">Google Gemini Vision Engine API (Active Session: node-cairo-01)</span>
</div>
</div>
<div className="flex items-center gap-space-sm">
<div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-lg bg-surface-container text-on-surface-variant font-label-code text-label-code">
<span>دقة التعرف:</span>
<span className="text-primary font-bold">98.94%</span>
</div>
<div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-lg bg-surface-container text-on-surface-variant font-label-code text-label-code">
<span>الحصص المتبقية اليوم:</span>
<span className="text-tertiary font-bold">4,820 ورقة</span>
</div>
</div>
</div>
</div>
<div className="fixed bottom-space-lg left-space-lg max-w-sm flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-high shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 z-50" id="toast-banner">
<div className="p-space-xs rounded-lg bg-primary/20 text-primary flex-shrink-0">
<span className="material-symbols-outlined text-xl">check_circle</span>
</div>
<div className="flex flex-col flex-1">
<span className="font-body-sm text-body-sm font-semibold text-on-surface">تم ربط مفتاح الذكاء الاصطناعي بنجاح</span>
<p className="font-label-code text-label-code text-on-surface-variant mt-0.5">سيرفر OCR جاهز الآن لاستخراج ومعالجة ملازم الامتحانات المباشرة.</p>
</div>
<button className="text-on-surface-variant hover:text-on-surface p-space-2xs rounded" id="close-toast-btn" type="button">
<span className="material-symbols-outlined text-base">close</span>
</button>
</div>
</div>
<script>
  (function() {
    const editor = document.getElementById('ocr-text-editor');
    const wordCountEl = document.getElementById('word-count');
    const charCountEl = document.getElementById('char-count');
    const copyBtn = document.getElementById('copy-text-btn');
    const exportBtn = document.getElementById('export-docx-btn');
    const startOcrBtn = document.getElementById('start-ocr-btn');
    const toastBanner = document.getElementById('toast-banner');
    const closeToastBtn = document.getElementById('close-toast-btn');
    const uploadNewTrigger = document.getElementById('upload-new-trigger');

    function updateCounters() {
      if (!editor) return;
      const text = editor.value.trim();
      const words = text ? text.split(/\s+/).length : 0;
      const chars = text.length;
      if (wordCountEl) wordCountEl.textContent = words.toLocaleString('ar-EG');
      if (charCountEl) charCountEl.textContent = chars.toLocaleString('ar-EG');
    }

    if (editor) {
      editor.addEventListener('input', updateCounters);
      updateCounters();
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        if (!editor) return;
        navigator.clipboard.writeText(editor.value).then(() => {
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = '<span className="material-symbols-outlined text-lg text-primary">done</span><span className="font-body-sm text-body-sm font-semibold text-primary">تم النسخ!</span>';
          setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
          }, 2000);
        });
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function() {
        const title = document.getElementById('document-title')?.value || 'وثيقة_مستخرجة';
        const blob = new Blob([editor?.value || ''], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = title.endsWith('.docx') ? title : title + '.docx';
        a.click();
      });
    }

    if (startOcrBtn) {
      startOcrBtn.addEventListener('click', function() {
        const originalText = startOcrBtn.innerHTML;
        startOcrBtn.innerHTML = '<span className="material-symbols-outlined text-xl animate-spin">progress_activity</span><span className="font-body-md text-body-md font-semibold">جارِ فحص وتدقيق الورقة...</span>';
        startOcrBtn.classList.add('opacity-75');
        
        setTimeout(() => {
          startOcrBtn.innerHTML = originalText;
          startOcrBtn.classList.remove('opacity-75');
          updateCounters();
        }, 1500);
      });
    }

    if (uploadNewTrigger) {
      uploadNewTrigger.addEventListener('click', function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function(e) {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
              const docImg = document.getElementById('source-document-image');
              if (docImg) docImg.src = event.target.result;
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      });
    }

    if (closeToastBtn && toastBanner) {
      closeToastBtn.addEventListener('click', function() {
        toastBanner.style.transform = 'translateY(100%)';
        toastBanner.style.opacity = '0';
        setTimeout(() => toastBanner.remove(), 300);
      });
    }
  })();
</script>