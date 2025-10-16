// api/senryu.js  (ESM版)  ← ファイル丸ごと置き換え
/* eslint-disable */
// @ts-nocheck  // VSCodeのTSチェックを一時無効化（.jsで型を使わないため）

import fetch from "node-fetch"; // Vercel/Node18+ なら global fetch でもOK

// ---- ユーティリティ ----
function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === "string") {
    return v
      .split(/[,\u3001\u3000]/) // , 、 全角スペース
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

async function fetchCurrentNewsHeadlines(theme) {
  // ニュース連携を使わないなら空で返す
  return [];
}

function buildPrompt({ mode, theme, keywords, satireLevel, eleganceLevel }) {
  const keys = (keywords || []).join("、");
  const flavor =
    mode === "current"
      ? `時事（${theme}）の話題を鋭く切る川柳を1つ。風刺度:${satireLevel}。`
      : `日常（${theme}）を題材に川柳を1つ。風流度:${eleganceLevel}。`;
  const keyLine = keys ? `キーワード：${keys}` : ``;
  return `${flavor}
${keyLine}
出力は川柳のみ、余計な説明なし。`;
}

async function callModel(prompt) {
  // 実際のモデル呼び出しに差し替えてください（例：OpenAI, Claude 等）
  // ここはダミー実装
  return `春風や\n会議室にも\n花が舞う`;
}

// ---- ハンドラ（Vercel/Next.js API Route互換） ----
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const mode = body?.mode === "current" ? "current" : "normal";
    const theme = (body?.theme || "自由").toString();
    const keywords = toArray(body?.keywords);
    const satireLevel = Number.isFinite(body?.satireLevel) ? body.satireLevel : 1;
    const eleganceLevel = Number.isFinite(body?.eleganceLevel) ? body.eleganceLevel : 1;

    // 時事モードならニュース（必要なら使用）
    let headlines = [];
    if (mode === "current") {
      headlines = await fetchCurrentNewsHeadlines(theme);
    }

    const prompt = buildPrompt({
      mode,
      theme,
      keywords,
      satireLevel,
      eleganceLevel,
      headlines,
    });

    const result = await callModel(prompt);

    res.status(200).json({ result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Server Error" });
  }
}