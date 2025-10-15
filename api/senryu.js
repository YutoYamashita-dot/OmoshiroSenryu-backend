// api/senryu.js
import OpenAI from "openai";

// CORS対応（ブラウザから直接叩く可能性があるなら付ける）
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end(); // CORS preflight
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    const { mode, theme, keywords, satireLevel = 1, ironyLevel = 1, count = 1 } = req.body || {};

    // 簡易バリデーション
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Server not configured (OPENAI_API_KEY missing)" });
    }
    if (!Array.isArray(keywords)) {
      return res.status(400).json({ error: "keywords must be an array" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      model: "gpt-5",          // 使うモデル名に合わせて調整
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.8,
      max_tokens: 240
    });

    const text = resp.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({ result: text });

  } catch (err) {
    console.error("server error:", err);
    return res.status(500).json({ error: "Generation failed" });
  }
}