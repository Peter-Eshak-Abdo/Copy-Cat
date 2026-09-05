import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 12;

export async function POST(req: NextRequest) {
  try {
    // 1. Cyber Security: Rate Limiting by IP or forwarded header
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "anonymous";
    const now = Date.now();
    const clientLimit = rateLimitMap.get(ip);

    if (clientLimit && now < clientLimit.resetTime) {
      if (clientLimit.count >= MAX_REQUESTS_PER_MINUTE) {
        return NextResponse.json(
          { error: "تم تجاوز الحد الأقصى للطلبات مؤقتاً. يرجى الانتظار دقيقة قبل المحاولة مجدداً." },
          { status: 429 }
        );
      }
      clientLimit.count += 1;
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    }

    // 2. Parse and Validate Payload
    const body = await req.json().catch(() => ({}));
    const {
      topic,
      targetPages = 5,
      includeIntro = true,
      includeConclusion = true,
      includeRefs = true,
    } = body;

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return NextResponse.json({ error: "من فضلك أدخل عنوان البحث المطلوب" }, { status: 400 });
    }

    // Input sanitization: Trim and restrict maximum length
    const sanitizedTopic = topic.trim().slice(0, 300);

    const prompt = `أنت باحث وأستاذ أكاديمي متخصص. اكتب بحثاً دراسياً وأكاديمياً شاملاً ومفصلاً جداً باللغة العربية حول: (${sanitizedTopic}).
المطلوب أن يكون البحث مكافئاً لحجم (${targetPages}) صفحات وورد مطبوعة، ويتميز بأسلوب بشري طبيعي ورصين، بعيداً تماماً عن الصياغات الآلية أو عبارات الذكاء الاصطناعي النمطية.

يرجى كتابة البحث في فقرات غنية بالمعلومات والتحليلات المقسمة إلى المباحث التالية:
${includeIntro ? "- مقدمة تمهيدية وافية وموسعة: تسلط الضوء على الأهمية البالغة لموضوع البحث وأبعاده العامة وخلفيته وتأثيره." : ""}
- المبحث الأول: الإطار المفاهيمي والنشأة والأبعاد التاريخية لموضوع (${sanitizedTopic}) بتفصيل دقيق وشامل.
- المبحث الثاني: العناصر الأساسية والركائز والأدوات والآليات العملية المرتبطة بالموضوع بعمق تحليلي واقعي.
- المبحث الثالث: التطبيقات العملية، والأثر الملموس، وأبرز التحديات والحلول المعاصرة.
- المبحث الرابع: الرؤى والتحليلات المستقبلية والدروس المستفادة.
${includeConclusion ? "- خاتمة البحث: تلخيص وافٍ لأهم النتائج المستخلصة والتوصيات العملية المقترحة." : ""}
${includeRefs ? "- قائمة المصادر والمراجع المعتمدة: تضم موسوعات، دوريات، ومراجع علمية عربية معاصرة." : ""}

قواعد حاسمة:
1. ابدأ بنص البحث فوراً دون أي تحيات أو تعليقات جانبية من الذكاء الاصطناعي.
2. اجعل العناوين الرئيسية تبدأ بكلمات واضحة مثل: (مقدمة البحث، المبحث الأول: ...، المبحث الثاني: ...، خاتمة البحث، المصادر والمراجع).
3. اكتب فقرات سردية متماسكة ومفصلة لكي تملأ الصفحات بالشكل الأكاديمي المطلوب.`;


    let contentText: string | null = null;
    let usedProvider = "";

    // =========================================================================
    // 1. Primary: Google Gemini 1.5 Flash (Ultra fast, 1M context, best Arabic quality)
    // =========================================================================
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const resp = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 8192,
            },
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
          if (contentText) usedProvider = "Google Gemini 1.5 Flash";
        }
      } catch (err) {
        console.warn("Gemini 1.5 Flash failed, trying next provider:", err);
      }
    }

    // =========================================================================
    // 2. Fallback 1: Groq Llama-3.3-70b-versatile (Extremely fast, low latency)
    // =========================================================================
    const groqKey = process.env.GROQ_API_KEY;
    if (!contentText && groqKey) {
      try {
        const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
        const resp = await fetch(groqUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,
            max_tokens: 6000,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          contentText = data?.choices?.[0]?.message?.content || null;
          if (contentText) usedProvider = "Groq Llama 3.3 70B";
        }
      } catch (err) {
        console.warn("Groq Llama 3.3 failed, trying next provider:", err);
      }
    }

    // =========================================================================
    // 3. Fallback 2: Groq Llama-3.1-8b-instant (Fastest backup model)
    // =========================================================================
    if (!contentText && groqKey) {
      try {
        const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
        const resp = await fetch(groqUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.6,
            max_tokens: 4000,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          contentText = data?.choices?.[0]?.message?.content || null;
          if (contentText) usedProvider = "Groq Llama 3.1 8B Instant";
        }
      } catch (err) {
        console.warn("Groq Llama 3.1 8B failed, trying next provider:", err);
      }
    }

    // =========================================================================
    // 4. Fallback 3: Cohere Command-R Plus (Superior multilingual writing)
    // =========================================================================
    const cohereKey = process.env.COHERE_API_KEY;
    if (!contentText && cohereKey) {
      try {
        const cohereUrl = "https://api.cohere.com/v1/chat";
        const resp = await fetch(cohereUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cohereKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "command-r-plus-08-2024",
            message: prompt,
            temperature: 0.6,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          contentText = data?.text || null;
          if (contentText) usedProvider = "Cohere Command-R+";
        }
      } catch (err) {
        console.warn("Cohere failed, trying next provider:", err);
      }
    }

    // =========================================================================
    // 5. Fallback 4: OpenRouter / Free Fallback Engine
    // =========================================================================
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!contentText && openrouterKey) {
      try {
        const orUrl = "https://openrouter.ai/api/v1/chat/completions";
        const resp = await fetch(orUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-exp:free",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          contentText = data?.choices?.[0]?.message?.content || null;
          if (contentText) usedProvider = "OpenRouter Gemini 2.0 Flash";
        }
      } catch (err) {
        console.warn("OpenRouter failed:", err);
      }
    }

    // Check if any provider succeeded
    if (!contentText) {
      return NextResponse.json(
        {
          error:
            "تعذر الوصول لجميع خوادم الذكاء الاصطناعي (Gemini, Groq 70B, Groq 8B, Cohere). يرجى التحقق من مفاتيح API.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      content: contentText,
      provider: usedProvider,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
