export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { model, messages } = req.body || {};

  const allowedModels = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];
  if (!model || !allowedModels.includes(model)) {
    return res.status(400).json({ error: "Invalid or missing model" });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Invalid or missing messages" });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 1000 }),
  });
  const data = await response.json();

  if (!response.ok) {
    return res.status(response.status).json(data);
  }

  res.json(data);
}