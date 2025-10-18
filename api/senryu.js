// /api/senryu.js  （ESM / Vercel Edge）
// 例: OpenAI API を利用。OPENAI_API_KEY をプロジェクト環境変数に設定してください。
export const config = { runtime: 'edge' };

const ELEGANCE_STYLE = [
  "素朴。日常の情景を淡く描く。比喩は最小限。",
  "やや風雅。季語・自然描写を軽く挿し込む。",
  "雅趣を強める。余白や間、音の響きを意識。",
  "非常に風流。侘び寂び・季節感を濃く、言い切りは控えめ。"
];

const SATIRE_STYLE = [
  "皮肉は抑えめ。微笑ましいオチで和ませる。",
  "軽い風刺。言い回しで少し突く。",
  "明確な風刺。社会や人間の滑稽を切り取る。",
  "強い風刺。問題点をズバッと斬り、痛快に落とす。"
];

function clampInt(n, min=0, max=3) {
  n = Number.isFinite(n) ? Math.round(n) : 0;
  return Math.min(max, Math.max(min, n));
}

// 出力の揺らぎ用（同じ入力でも完全固定を避ける）
// 決定論は不要＝seed風のノイズを付与
function randomizeTemp(base = 0.9) {
  // 0.85〜1.05で揺らす
  const jitter = (Math.random() * 0.2) - 0.1;
  return Math.min(1.2, Math.max(0.2, base + jitter));
}

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const {
      mode = "normal",
      theme = "自由",
      keywords = [],
      satireLevel = 1,
      eleganceLevel = 1,
      count = 1
    } = await req.json();

    const e = clampInt(eleganceLevel);
    const s = clampInt(satireLevel);

    const eleganceHint = ELEGANCE_STYLE[e];
    const satireHint = SATIRE_STYLE[s];

    // 時事モードの指示は「最新の話題を想起」するためのヒントに留める
    const modeHint = mode === "current"
      ? "テーマは「時事」。直近のニュースを想起させる語感で、具体名の連呼は避け、固有名は最小限。"
      : "テーマは「日常・一般」。身近な情景や人間模様を中心に表現。";

    const kwText = Array.isArray(keywords) && keywords.length
      ? `キーワード（任意で含める）：${keywords.join("、")}`
      : "キーワード指定なし";

    const system = [
      "あなたは日本語の川柳作家です。",
      "形式は五・七・五の三行。句読点は最小限。過剰な説明はしない。",
      "出力は川柳本文のみ（3行）。前置きや解説は不要。"
    ].join("\n");

    const user = [
      `モード：${mode}`,
      `テーマ：${theme}`,
      kwText,
      `風流度（0〜3）：${e} → ${eleganceHint}`,
      `風刺度（0〜3）：${s} → ${satireHint}`,
      modeHint,
      "言い換えや比喩で新鮮味を出し、類型的なフレーズは避ける。",
      "同じネタ・同じオチを連発しない。"
    ].join("\n");

    const temperature = randomizeTemp(0.9);
    const body = {
      model: "gpt-4o-mini",            // お使いのモデルに合わせて変更可
      temperature,
      n: 1,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: user }
      ]
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return new Response(JSON.stringify({ error: `Upstream error (${resp.status})`, detail: txt }), { status: 500 });
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return new Response(JSON.stringify({ error: "空の応答" }), { status: 500 });
    }

    // 3行に整形（保険）
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    const three = lines.length >= 3
      ? lines.slice(0, 3)
      : (lines.join("").match(/.{1,7}/g) ?? []).slice(0,3); // 足りないときは適当に分割

    return new Response(JSON.stringify({ result: three.join("\n") }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Unhandled error" }), { status: 500 });
  }
}