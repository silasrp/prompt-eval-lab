// api/score.js
// LLM-as-judge: sends the original prompt + response to OpenAI with
// a structured rubric and returns real scores for 4 dimensions.
// Always uses gpt-4o-mini for speed + cost regardless of which model
// was used to generate the response being evaluated.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, response, strategy } = req.body;

  if (!prompt || !response) {
    return res.status(400).json({ error: "prompt and response are required" });
  }

  const judgePrompt = `You are an expert LLM output evaluator. Score the following AI response on 4 dimensions, each from 1.0 to 10.0 (one decimal place).

---
PROMPT STRATEGY: ${strategy || "unknown"}

ORIGINAL PROMPT SENT TO MODEL:
${prompt}

MODEL RESPONSE:
${response}
---

Return ONLY a valid JSON object — no markdown, no explanation outside the JSON:
{
  "relevance": <number 1.0–10.0>,
  "accuracy": <number 1.0–10.0>,
  "coherence": <number 1.0–10.0>,
  "instruction": <number 1.0–10.0>,
  "rationale": "<one sentence explaining the scores>"
}

Scoring criteria:
- relevance: Does the response directly and fully address what was asked?
- accuracy: Is the information factually correct and free of hallucinations?
- coherence: Is the response well-structured, logical, and easy to follow?
- instruction: Did the model follow the prompt's format, role, or output constraints?`;

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: judgePrompt }],
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}));
      return res.status(openaiRes.status).json({ error: err?.error?.message || "OpenAI error" });
    }

    const data = await openaiRes.json();
    const text = data.choices?.[0]?.message?.content;

    const scores = JSON.parse(text);

    // Validate and clamp all numeric fields
    const clamp = (v) => Math.min(10, Math.max(1, Math.round(Number(v) * 10) / 10));
    return res.status(200).json({
      relevance:   clamp(scores.relevance),
      accuracy:    clamp(scores.accuracy),
      coherence:   clamp(scores.coherence),
      instruction: clamp(scores.instruction),
      rationale:   String(scores.rationale || "").slice(0, 300),
    });
  } catch (err) {
    console.error("Scoring error:", err);
    return res.status(500).json({ error: "Failed to score response: " + err.message });
  }
}
