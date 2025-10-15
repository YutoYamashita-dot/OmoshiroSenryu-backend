// api/senryu.js
import OpenAI from "openai";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

// === OpenAI応答からテキストを堅牢に取り出すユーティリティ ===
function extractTextFromChoice(choice) {
  if (!choice) return "";

  // ① 従来: string でくる
  const msg = choice.message;
  if (typeof msg?.content === "string") {
    return msg.content.trim();
  }

  // ② 一部SDK: contentが配列（{type:"text", text:"..."}）
  if (Array.isArray(msg?.content)) {
    const joined = msg.content
      .map(p => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim();
    if (joined) return joined;
  }

  // ③ 念のため choice.content 側の配列対応
  if (Array.isArray(choice?.content)) {
    const joined = choice.content
      .map(p => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim();
    if (joined) return joined;
  }

  return "";
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
  } catch {
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

  // 軽い入力クレンジング
  const safeCount = Math.max(1, Math.min(5, Number(count) || 1));
  const safeKeywords = keywords.filter(x => typeof x === "string").slice(0, 8);

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // ★ モデルは環境変数で上書き可。未設定なら無難なものに。
    const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const system = `あなたは川柳職人です。5-7-5を基本に、現代的な自由度も許容しつつ、
- 「意外性と納得感」「緊張と緩和」「軽い風刺と皮肉」をバランス良く
- 過度な攻撃性・名誉毀損・差別は避ける（個人名は配慮）
- 音数の気持ちよさとオチを重視
- 出力は${safeCount}本。番号や説明は不要。`;

    const user = `
【モード】${mode === "current" ? "時事" : "普通"}
【テーマ】${theme || "自由"}
【キーワード】${safeKeywords.join("、")}
【皮肉度】${ironyLevel}/3
【風刺度】${satireLevel}/3
川柳のみを出力。`;

    const resp = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // 注意: 一部モデルは temperature 非対応。指定しない。
      max_completion_tokens: 320, // 余裕を少し増やす
    });

    // ★デバッグ：応答の全体像を確認（必要に応じてコメントアウト可）
    console.log("openai raw:", JSON.stringify(resp, null, 2));

    const choice = resp?.choices?.[0];
    let text = extractTextFromChoice(choice);

    // 返却テキストが空の時は finish_reason 等を返して原因特定しやすく
    if (!text) {
      const reason = choice?.finish_reason || "unknown";
      return res.status(502).json({
        error: `No content returned from model (finish_reason=${reason})`,
      });
    }

    return res.status(200).json({ result: text });
  } catch (err) {
    const msg =
      err?.response?.data?.error?.message ||
      err?.error?.message ||
      err?.message ||
      "Generation failed";
    console.error("OpenAI error:", msg);
    return res.status(500).json({ error: msg });
  }
}