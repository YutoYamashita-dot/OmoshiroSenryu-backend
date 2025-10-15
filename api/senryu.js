// api/senryu.js
import OpenAI from "openai";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  // ---- ① ボディの安全パース ----
  let body = req.body;
  try {
    if (!body) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      body = raw ? JSON.parse(raw) : {};
    } else if (typeof body === "string") {
      body = JSON.parse(body);
    }
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const {
    mode = "normal",
    theme = "",
    keywords = [],
    satireLevel = 1,
    ironyLevel = 1,
    count = 1,
  } = body || {};

  // ---- ② 事前チェック ----
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not set on server" });
  }
  if (!Array.isArray(keywords)) {
    return res.status(400).json({ error: "keywords must be an array of strings" });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // ★ まずは確実に使えるモデルで動作確認（後で戻してOK）
    const MODEL = process.env.OPENAI_MODEL || "gpt-5";

    const system = `あなたは川柳職人です。5-7-5を基本に、現代的な自由度も許容しつつ、
- 「意外性と納得感」「緊張と緩和」「軽い風刺と皮肉」をバランス良く
- 過度な攻撃性・名誉毀損・差別は避ける（個人名は配慮）
- 音数の気持ちよさとオチを重視
- 出力は${count}本。番号や説明は不要。`;

    const user = `
【モード】${mode === "current" ? "時事" : "普通"}
【テーマ】${theme || "自由"}
【キーワード】${keywords.join("、")}
【皮肉度】${ironyLevel}/3
【風刺度】${satireLevel}/3
川柳のみを出力。`;

    const resp = await openai.chat.completions.create({
  model: MODEL,
  messages: [
    { role: "system", content: system },
    { role: "user", content: user },
  ],
  max_completion_tokens: 240,  // ← 新仕様
});

    const text = resp.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({ result: text });
  } catch (err) {
    // ---- ③ デバッグ用に OpenAI の詳細を返す（必要に応じて外す）----
    const msg =
      err?.response?.data?.error?.message ||
      err?.error?.message ||
      err?.message ||
      "Generation failed";
    console.error("OpenAI error:", msg);
    return res.status(500).json({ error: msg });
  }
}