// pages/api/senryu.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Parser from "rss-parser";
import dayjs from "dayjs";
import ja from "dayjs/locale/ja";
dayjs.locale(ja);

// 既存：LLM 呼び出し関数（あなたの環境のままでOK）
async function callLLM(prompt: string): Promise<string> {
  // OpenAI/Claude など既存実装を呼ぶ
  // return await xxx(prompt)
  throw new Error("callLLM 未実装。あなたの既存呼び出しに差し替えてください。");
}

type Body = {
  mode?: "normal" | "current";
  theme?: string;
  keywords?: string[];
  satireLevel?: number;
  eleganceLevel?: number;
  count?: number;

  recencyDays?: number;
  region?: string;
  language?: string;
  maxArticles?: number;
  sources?: string[]; // ["googleNews"]
  includeCitations?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const {
      mode = "normal",
      theme = "自由",
      keywords = [],
      satireLevel = 1,
      eleganceLevel = 1,
      count = 1,

      recencyDays = 3,
      region = "JP",
      language = "ja",
      maxArticles = 6,
      sources = ["googleNews"],
      includeCitations = true,
    } = (typeof req.body === "string" ? JSON.parse(req.body) : req.body || {}) as Body;

    // === 1) ニュース取り込み（時事モードのみ） =========================
    let facts: { title: string; date: string; link: string }[] = [];

    if (mode === "current") {
      const parser = new Parser();
      const q = encodeURIComponent([theme, ...keywords].filter(Boolean).join(" "));
      const when = `when:${Math.max(1, recencyDays)}d`;
      const feedUrl = `https://news.google.com/rss/search?q=${q}+${when}&hl=${language}&gl=${region}&ceid=${region}:${language}`;
      const feed = await parser.parseURL(feedUrl);

      facts = (feed.items || [])
        .slice(0, maxArticles)
        .map((it) => ({
          title: it.title || "",
          date: it.pubDate ? dayjs(it.pubDate).format("YYYY-MM-DD") : "",
          link: it.link || (it.guid as string) || "",
        }))
        // タイトル重複を除去
        .filter((v, i, a) => a.findIndex(x => x.title === v.title) === i);
    }

    // === 2) プロンプト構築 ===============================================
    // 事実箇条書きを付け、川柳は季語不要・5-7-5 目安・辛口/風流度のガイドを与える
    const today = dayjs().format("YYYY-MM-DD");
    const bullets = facts.map((f, idx) => `- [${idx+1}] ${f.date} ${f.title}`).join("\n");
    const citations = includeCitations
      ? `出典:\n${facts.map((f, idx) => `[${idx+1}] ${f.link}`).join("\n")}`
      : "";

    const styleHints =
      mode === "current"
        ? `時事性を最優先。婉曲表現より具体を。辛口=${satireLevel}, 風流=${eleganceLevel}`
        : `辛口=${satireLevel}, 風流=${eleganceLevel}`;

    const prompt = `
今日の日付: ${today}
モード: ${mode}
テーマ: ${theme}
キーワード: ${keywords.join("、") || "（なし）"}

${
  mode === "current" && facts.length
    ? `【最近の見出し（時事の根拠）】
${bullets}

${citations}`
    : "（時事の根拠が不足しています。一般的な傾向から着想してください。）"
}

【タスク】
- 日本語の川柳を1つ生成（必要なら季語なしでも可）
- 5-7-5を“目安”に自然さを優先（厳密な字数にはこだわり過ぎない）
- ${styleHints}
- 最新見出しから着想し、固有名詞・出来事を1つは織り込む（過剰断定は避ける）

【出力形式】
川柳のみ（前置きや説明は不要）
    `.trim();

    // === 3) 生成 ========================================================
    const outputs: string[] = [];
    for (let i = 0; i < Math.max(1, count); i++) {
      const s = await callLLM(prompt);
      outputs.push((s || "").trim());
    }

    // === 4) レスポンス ===================================================
    res.status(200).json({
      result: outputs.join("\n"),
      usedFacts: includeCitations ? facts : undefined,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "server_error" });
  }
}