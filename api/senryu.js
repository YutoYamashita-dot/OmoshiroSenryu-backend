// api/senryu.js
// ★ TypeScript の記法は禁止（import type, 型注釈, type alias, as など）
// ★ Vercel の Node.js Serverless Function（ESM）用のシンプルな実装

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === "string") {
    return v.split(/[,\u3001\u3000、]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function buildPrompt(opts) {
  const mode = opts && opts.mode === "current" ? "current" : "normal";
  const theme = (opts && opts.theme) ? String(opts.theme) : "自由";
  const keywords = toArray(opts && opts.keywords);
  const satireLevel = Number.isFinite(opts && opts.satireLevel) ? opts.satireLevel : 1;
  const eleganceLevel = Number.isFinite(opts && opts.eleganceLevel) ? opts.eleganceLevel : 1;

  const keysStr = keywords.join("、");
  const flavor = mode === "current"
    ? `時事（${theme}）の話題を鋭く切る川柳を1つ。風刺度:${satireLevel}。`
    : `日常（${theme}）を題材に川柳を1つ。風流度:${eleganceLevel}。`;
  const keyLine = keysStr ? `キーワード：${keysStr}` : ``;

  return `${flavor}
${keyLine}
出力は川柳のみ、余計な説明なし。`;
}

// TODO: 実運用では OpenAI/Claude などの呼び出しに差し替え
async function callModel(prompt) {
  // デバッグ用のダミー出力
  return `春風や\n会議室にも\n花が舞う`;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      res.status(200).json({ ok: true, route: "/api/senryu" });
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch (e) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    const prompt = buildPrompt({
      mode: body.mode,
      theme: body.theme,
      keywords: body.keywords,
      satireLevel: body.satireLevel,
      eleganceLevel: body.eleganceLevel
    });

    const result = await callModel(prompt);
    res.status(200).json({ result });
  } catch (e) {
    console.error("API /api/senryu error:", e);
    res.status(500).json({ error: e && e.message ? e.message : "Server Error" });
  }
}