// api/senryu.js
export default async function handler(req, res) {
  try {
    // ✅ ① CORS（外部からアクセスできるようにする設定）
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).end();

    // ✅ ② POST 以外は禁止
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    // ✅ ③ Androidアプリから送られてきたデータを受け取る
    const { a, b } = req.body || {};
    if (!a || !b) {
      return res.status(400).json({ error: "Missing 'a' or 'b' in body" });
    }

    // ✅ ④ OpenAI（ChatGPT）に「川柳を作って」とお願いする
    const body = {
      model: "gpt-4o-mini", // 小型で安くて高速なモデル
      temperature: 0.9,      // 面白さ・創造性の強さ
      messages: [
        {
          role: "system",
          content: "あなたは川柳職人。出力は必ず3行（5-7-5風）。A語とB語を必ず入れる。皮肉・意外性・緊張と緩和を活用。説明や余計な文字は出さない。"
        },
        {
          role: "user",
          content: `キーワードA:「${a}」, キーワードB:「${b}」。この2語を必ず含めて、1首だけ。`
        }
      ]
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(500).json({ error: "OpenAI error", detail: text });
    }

    // ✅ ⑤ ChatGPTの返答（川柳）を受け取る
    const json = await r.json();
    const senryu = json?.choices?.[0]?.message?.content?.trim() ?? "";

    // ✅ ⑥ Androidアプリに返す
    return res.status(200).json({ senryu });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server error" });
  }
}
