import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { topic, includeIntro = true, includeConclusion = true, includeRefs = true } =
      await req.json();

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "من فضلك أدخل عنوان البحث" }, { status: 400 });
    }

    const prompt = `اكتب بحثاً أكاديمياً تفصيلياً وشاملاً جداً وموسعاً باللغة العربية حول موضوع: (${topic.trim()}).
يجب أن يكون البحث طويلاً ومليئاً بالمعلومات العميقة والشرح المفصل لكل عنصر، ومقسماً إلى الأقسام التالية بنسق أكاديمي متكامل:
${includeIntro ? "- مقدمة تمهيدية شاملة وموسعة توضح أهمية المبحث وأهدافه وفلسفته." : ""}
- صلب الموضوع: مقسم إلى عدة مباحث وفروع تفصيلية عميقة تغطي كافة جوانب وتطبيقات ${topic.trim()} بشكل أكاديمي متكامل وبأقصى تفصيل ممكن وبدون أي اختصار.
${includeConclusion ? "- خاتمة نهائية تلخص أدق نتائج الدراسة والتوصيات المستقاة." : ""}
${includeRefs ? "- قائمة مصادر ومراجع حقيقية وموثوقة (كتب ومجلات علمية معاصرة)." : ""}
ملاحظة هامة: ابدأ بنص البحث مباشرة دون أي مقدمات ترحيبية أو ردود جانبية من الذكاء الاصطناعي، واجعل العناوين واضحة وجلية الملامح.`;

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
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "حدث خطأ غير متوقع" }, { status: 500 });
  }
}
