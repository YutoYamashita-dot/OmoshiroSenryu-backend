// ESM版: おもしろ川柳API
export const dynamic = "force-dynamic";
export const config = { runtime: "edge" };

// 環境変数 OPENAI_API_KEY を使用
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // キャッシュを完全に無効化
    const headers = {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json",
    };

    const bodyText = await req.text();
    const body = JSON.parse(bodyText || "{}");

    const {
      mode = "normal",
      theme = "自由",
      keywords = [],
      satireLevel = 1,
      eleganceLevel = 1,
      count = 1,
    } = body;

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
        status: 500,
        headers,
      });
    }

    // 多様化パラメータ
    const seed = Math.floor(Math.random() * 1e9);
    const PERSONAS = [
      "辛口コメンテーター",
      "皮肉屋のサラリーマン",
      "達観した俳人",
      "ニュース記者",
      "皮肉たっぷりの評論家",
      "道端の哲学者",
    ];
    const TONES = [
      "毒舌",
      "軽妙",
      "アイロニー強め",
      "静かな諷刺",
      "ユーモア濃いめ",
      "辛辣",
    ];

    const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
    const tone = TONES[Math.floor(Math.random() * TONES.length)];

    // キーワードのランダム選択
    const shuffled = Array.isArray(keywords)
      ? [...keywords].sort(() => Math.random() - 0.5)
      : [];
    const pickedKeywords = shuffled.slice(0, Math.min(4, shuffled.length));

    const currentExtra =
      mode === "current"
        ? "\n- 最新のニュース語彙や社会問題を自然に盛り込む（例：AI、円安、選挙、地球温暖化、政治家など）"
        : "";

    const nCandidates = 3;

    const systemPrompt = `
あなたは辛辣でユーモアのある川柳作家です。短く的確に、現代語と古風さを織り交ぜます。
出力はプレーンテキストのみ。余分な説明や前後の文は書かない。
`.trim();

    const userPrompt = `
【作詩条件】
- モード: ${mode}
- テーマ: ${theme}
- キーワード: ${pickedKeywords.join("、") || "（なし）"}
- 風刺レベル(0-3): ${satireLevel}
- 風流レベル(0-3): ${eleganceLevel}
- ペルソナ: ${persona}
- トーン: ${tone}
- 乱数シード: ${seed}
${currentExtra}

【要件】
- 5-7-5 を基本としつつ、自然な日本語の面白さ・痛快さを優先。
- 時事モードでは“今”の空気やニュースの言い回しを織り込む。
- 1首のみを出力。前後の説明文・引用符は不要。改行で3行に分ける。
`.trim();

    // OpenAI API呼び出し
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.9,
        top_p: 0.95,
        presence_penalty: 0.6,
        frequency_penalty: 0.4,
        n: nCandidates,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI Error:", openaiRes.status, errText);
      return new Response(
        JSON.stringify({ error: `OpenAI error ${openaiRes.status}` }),
        { status: 500, headers }
      );
    }

    const data = await openaiRes.json();
    const choices = Array.isArray(data?.choices) ? data.choices : [];
    if (choices.length === 0) {
      return new Response(JSON.stringify({ error: "Empty completion" }), {
        status: 500,
        headers,
      });
    }

    // 候補からランダム1首を選ぶ
    const pick = choices[Math.floor(Math.random() * choices.length)];
    let result = (pick?.message?.content || "").trim();

    // 不要文字除去
    result = result.replace(/^```[\s\S]*?```$/g, "").trim();
    result = result.replace(/^["'「『]+|["'」』]+$/g, "").trim();

    // 結果を返す
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("Server Error:", err);
    return new Response(JSON.stringify({ error: "Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}