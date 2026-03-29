// api/experiments.js
// GET  /api/experiments        → return all saved experiments (newest first)
// POST /api/experiments        → save a new experiment result
// DELETE /api/experiments?id=X → remove one experiment by id
//
// Requires Upstash Redis. Add an Upstash Redis store via the Vercel Marketplace
// (Storage → Upstash Redis → Create), then link it to this project.
// Vercel auto-injects these env vars when you link the store:
//   KV_REST_API_URL, KV_REST_API_TOKEN
// Install locally with: npm install @upstash/redis

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const KEY = "experiments";
const MAX_EXPERIMENTS = 50;

export default async function handler(req, res) {
  try {
    // ── GET ────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const raw = await redis.lrange(KEY, 0, MAX_EXPERIMENTS - 1);
      const experiments = raw.map((item) =>
        typeof item === "string" ? JSON.parse(item) : item
      );
      return res.status(200).json(experiments);
    }

    // ── POST ───────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const {
        title, strategyId, strategyLabel, winnerTag, winnerColor,
        model, task, prompt, scores, elapsed, rationale,
      } = req.body;

      if (!title || !scores) {
        return res.status(400).json({ error: "title and scores are required" });
      }

      const experiment = {
        id: Date.now(),
        date: new Date().toISOString().slice(0, 7), // "YYYY-MM"
        title,
        strategyId,
        strategyLabel,
        winnerTag,
        winnerColor,
        model,
        task,
        prompt,
        scores,
        elapsed: elapsed || null,
        rationale: rationale || "",
        savedAt: new Date().toISOString(),
      };

      // Prepend so newest is first; trim to cap total count
      await redis.lpush(KEY, JSON.stringify(experiment));
      await redis.ltrim(KEY, 0, MAX_EXPERIMENTS - 1);

      return res.status(201).json(experiment);
    }

    // ── DELETE ─────────────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "id query param required" });

      const raw = await redis.lrange(KEY, 0, MAX_EXPERIMENTS - 1);
      const filtered = raw.filter((item) => {
        const obj = typeof item === "string" ? JSON.parse(item) : item;
        return String(obj.id) !== String(id);
      });

      // Re-write the list without the deleted item
      await redis.del(KEY);
      if (filtered.length > 0) {
        // rpush maintains order (oldest→newest after delete + re-push)
        for (const item of [...filtered].reverse()) {
          await redis.lpush(KEY, typeof item === "string" ? item : JSON.stringify(item));
        }
      }

      return res.status(200).json({ deleted: id });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Experiments API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
