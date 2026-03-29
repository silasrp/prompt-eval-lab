# prompt_eval.lab

> A live prompt engineering evaluation playground — run experiments, score outputs with an LLM judge, and build a persistent portfolio of results.

![Stack](https://img.shields.io/badge/React-Vite-61dafb?style=flat-square&logo=react)
![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)
![Powered by OpenAI](https://img.shields.io/badge/Powered%20by-OpenAI-412991?style=flat-square&logo=openai)
![Storage](https://img.shields.io/badge/Storage-Upstash%20Redis-dc382d?style=flat-square&logo=redis)

---

## What is this?

Most people treat prompt engineering as intuition — they tweak a prompt, get a better result, and move on. This project treats it as a science.

**prompt_eval.lab** is a full-stack experiment workbench that lets you apply six distinct prompt engineering strategies to any task, run the prompt against multiple OpenAI models in real time, evaluate the output using a second AI model acting as an impartial judge, and save every scored result to a persistent portfolio — so you can compare strategies across tasks and models over time.

The core idea is simple: **the same task, asked differently, produces measurably different results.** This tool makes that difference visible, quantifiable, and repeatable.

---

## Live demo

🔗 **[prompt-eval-lab.vercel.app](https://prompt-eval-lab.vercel.app)** ← replace with your URL

---

## Features

### Playground
- **Six prompt strategies** — Zero-Shot, Few-Shot, Chain of Thought, Role Prompting, Self-Critique, and Structured Output — each with a pre-built template that wraps your task
- **Live compiled prompt preview** — see exactly what gets sent to the model before you run it
- **Model selector** — switch between GPT-4o, GPT-4o Mini, GPT-4 Turbo, and GPT-3.5 Turbo without reloading
- **Response timing** — measures and displays latency per run
- **LLM-as-judge scoring** — a second call to `gpt-4o-mini` with a structured rubric evaluates the response across four dimensions: Relevance, Accuracy, Coherence, and Instruction Following
- **Judge rationale** — the evaluator returns a one-sentence explanation of why it scored the response the way it did
- **Save to portfolio** — any scored result can be persisted with one click

### Experiments portfolio
- **Persistent storage** — all saved experiments are stored in Upstash Redis and loaded fresh on every visit
- **Real computed stats** — experiment count, average score, and most-used strategy are calculated from actual saved data
- **Expandable result cards** — task, judge rationale, per-dimension score bars, and overall score on demand
- **Delete** — remove any experiment from the portfolio

### Security
- The OpenAI API key never touches the browser — all API calls are proxied through Vercel serverless functions
- The Redis credentials are injected server-side via Vercel environment variables only

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  BROWSER  (React + Vite)                                │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │  Playground UI   │  │  Experiments tab │             │
│  │  select strategy │  │  portfolio view  │             │
│  │  run · score     │  │  computed stats  │             │
│  └────────┬─────────┘  └────────┬─────────┘             │
└───────────┼─────────────────────┼───────────────────────┘
            │  fetch /api/*       │  fetch /api/experiments
            ▼                     ▼
┌─────────────────────────────────────────────────────────┐
│  VERCEL EDGE  (CDN + Serverless routing)                │
│  Serves static React build, routes /api/* to functions  │
└──────────┬──────────────┬────────────────┬──────────────┘
           ▼              ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│ /api/chat.js │  │/api/score.js │  │/api/experiments.js   │
│              │  │              │  │                      │
│ Validates    │  │ Builds judge │  │ GET  → lrange (KV)   │
│ model param  │  │ rubric prompt│  │ POST → lpush (KV)    │
│ Proxies to   │  │ Calls 4o-mini│  │ DELETE → filter+     │
│ OpenAI API   │  │ Parses JSON  │  │         rewrite (KV) │
│ Injects key  │  │ Clamps scores│  │ Caps at 50 records   │
└──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘
       │                 │                      │
       ▼                 ▼                      ▼
┌─────────────────────┐            ┌────────────────────────┐
│  OpenAI API         │            │  Upstash Redis (KV)    │
│  /v1/chat/completions│           │  Serverless Redis store │
│  model: user choice │            │  Accessed via REST API  │
│  model: gpt-4o-mini │            │  KV_REST_API_URL +      │
│  (for judge calls)  │            │  KV_REST_API_TOKEN      │
└─────────────────────┘            └────────────────────────┘

All secrets (OPENAI_API_KEY, KV_REST_API_URL, KV_REST_API_TOKEN)
live exclusively in Vercel environment variables — never client-side.
```

### Layer-by-layer breakdown

**① Browser — React + Vite**

The entire frontend is a single-page React application bundled by Vite. No Next.js, no SSR — just a fast static build served from Vercel's CDN. State is managed with React's built-in `useState` and `useEffect` hooks. There is no client-side routing library; the two views (playground and experiments) are toggled with a single `tab` state variable. The frontend never holds an API key or credentials of any kind — it only knows about relative paths like `/api/chat`.

**② Vercel Edge — CDN + routing layer**

Vercel serves the compiled static build globally from its CDN. Any request to a path starting with `/api/` is automatically intercepted and routed to the corresponding serverless function in the `/api` directory. This routing is zero-config — Vercel infers it from the file system. This layer is also where environment variables are injected at runtime, making them available to serverless functions without ever exposing them to the client bundle.

**③ Serverless Functions — the secure API layer**

Three independent Node.js functions handle all privileged operations:

- **`/api/chat.js`** — receives `{ model, messages }` from the client, validates that the model is in the allowlist, then forwards the request to OpenAI's `/v1/chat/completions` endpoint with the server-side API key injected. It acts purely as a secure proxy. No key is ever returned to the client.

- **`/api/score.js`** — receives the original `prompt`, the model's `response`, and the `strategy` name. It constructs a structured evaluation rubric and calls `gpt-4o-mini` with `response_format: { type: "json_object" }` to guarantee parseable output. The judge scores four dimensions (Relevance, Accuracy, Coherence, Instruction Following) from 1.0–10.0 and provides a one-sentence rationale. Scores are clamped and validated before returning. This function always uses `gpt-4o-mini` regardless of which model generated the response — it keeps scoring fast and cost-consistent.

- **`/api/experiments.js`** — a mini REST API for the experiment portfolio. GET returns all experiments from Redis using `lrange`. POST prepends a new experiment with `lpush` and trims the list to a maximum of 50 entries with `ltrim`. DELETE reads the list, filters out the target ID, deletes the key, and rewrites the filtered list. The Redis client is initialised from `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables; if they are absent (e.g. local development without a store), the function degrades gracefully — GET returns an empty array, POST and DELETE return a `503` with a clear message.

**④ External services**

- **OpenAI API** — the inference engine for both prompt execution and evaluation. Two separate roles: (a) the model selected by the user for running experiments, and (b) `gpt-4o-mini` hardcoded as the judge to keep evaluation cost low and deterministic.

- **Upstash Redis** — a serverless Redis provider accessible over HTTP REST. Chosen because Vercel's native KV and Upstash Redis share the same `@upstash/redis` client and environment variable conventions, making them interchangeable. Data model is a single Redis list keyed `"experiments"`, with newest entries at the head.

---

## How it works

The full lifecycle of a single experiment, end to end:

### Step 1 — strategy selection
The user picks one of six strategies from the pill selector. Each strategy is a template string with a `{task}` placeholder. Selecting a strategy instantly re-renders the compiled prompt preview panel — the user sees the exact text that will be sent to the model before committing to a run.

```
Zero-Shot:        "Answer the following question:\n\n{task}"
Few-Shot:         "Here are some examples: ... Now answer:\nQ: {task}\nA:"
Chain of Thought: "Think through this step by step ... Question: {task}"
Role Prompting:   "You are a world-class expert ... Task: {task}"
Self-Critique:    "Answer ... then critique ... Task: {task}\n\nInitial answer:"
Structured Output: "Respond ONLY in this JSON format: {...}\n\nTask: {task}"
```

### Step 2 — running the experiment
The user types a task and clicks **Run Experiment**. The frontend calls `POST /api/chat` with `{ model, messages: [{ role: "user", content: compiledPrompt }] }`. The serverless function validates the model, injects `OPENAI_API_KEY`, and forwards to OpenAI. The response streams back and the model's reply is rendered in the output panel with elapsed time.

```
Browser → POST /api/chat → Vercel fn → OpenAI /v1/chat/completions → response text
```

### Step 3 — LLM-as-judge scoring
After a response appears, the user clicks **Score with LLM Judge**. The frontend calls `POST /api/score` with the compiled prompt, the model's response, and the strategy label. The serverless function constructs a judge prompt:

```
You are an expert LLM output evaluator. Score the following AI response
on 4 dimensions, each from 1.0 to 10.0...

PROMPT STRATEGY: Chain of Thought
ORIGINAL PROMPT: Think through this step by step...
MODEL RESPONSE: [the actual response]

Return ONLY valid JSON: { relevance, accuracy, coherence, instruction, rationale }
```

This is sent to `gpt-4o-mini` with `temperature: 0` and `response_format: { type: "json_object" }`. The returned scores are clamped to the 1.0–10.0 range and returned to the client, where they render as circular dial visualisations with an overall average.

```
Browser → POST /api/score → Vercel fn → OpenAI (gpt-4o-mini) → { scores, rationale }
```

### Step 4 — saving to the portfolio
The user clicks **Save Experiment**. The frontend calls `POST /api/experiments` with the full experiment object — strategy, model, task, prompt, scores, elapsed time, and the judge's rationale. The serverless function pushes it to the head of a Redis list and trims the list to 50 entries.

```
Browser → POST /api/experiments → Vercel fn → Upstash Redis lpush → { saved experiment }
```

The saved experiment immediately appears in the Experiments tab without a page reload (the root component's `experiments` state is updated optimistically).

### Step 5 — loading the portfolio
On initial page load, the root component fires `GET /api/experiments`, which calls `lrange experiments 0 49` on Redis. The returned list is set into React state and renders as expandable cards. Stats (average score, most-used strategy, total count) are computed in the client from the live data — no hardcoded numbers anywhere.

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast build, no SSR overhead needed |
| Hosting | Vercel | Free tier, zero-config serverless functions, CDN |
| API proxy | Vercel Serverless Functions (Node.js) | Keeps API keys off the client |
| LLM inference | OpenAI API (`gpt-4o`, `gpt-4o-mini`, etc.) | Best-in-class models, structured output support |
| LLM evaluation | OpenAI `gpt-4o-mini` + `response_format: json_object` | Fast, cheap, deterministic judge |
| Persistence | Upstash Redis | Serverless Redis with HTTP REST — no connection pools |
| Styling | Inline React styles | Zero dependencies, full control |

---

## Prompt strategies reference

| Tag | Strategy | Core technique | Best for |
|---|---|---|---|
| ZS | Zero-Shot | Bare instruction | Baseline measurement |
| FS | Few-Shot | 2–3 worked examples | Format/style transfer |
| CoT | Chain of Thought | "Think step by step" | Reasoning, math, logic |
| RP | Role Prompting | Expert persona assignment | Tone, depth, authority |
| SC | Self-Critique | Generate → critique → improve | Quality, completeness |
| SO | Structured Output | Rigid JSON schema | Parsing, reliability |

---

## Evaluation dimensions

Each response is scored 1.0–10.0 on four axes by `gpt-4o-mini` acting as an impartial judge:

- **Relevance** — does the response directly address what was asked?
- **Accuracy** — is the information factually correct and free of hallucination?
- **Coherence** — is the response logically structured and easy to follow?
- **Instruction Following** — did the model respect the prompt's format, role, or schema constraints?

The overall score is the arithmetic mean of the four dimensions.

---

## Project structure

```
prompt-eval-lab/
├── api/
│   ├── chat.js           # Secure OpenAI proxy
│   ├── score.js          # LLM-as-judge evaluator
│   └── experiments.js    # Experiment persistence (Upstash Redis)
├── src/
│   ├── App.jsx           # Entire frontend (single component file)
│   └── main.jsx          # Vite entry point
├── public/
├── index.html
├── vite.config.js
└── package.json
```

---

## Local development

```bash
# 1. Clone and install
git clone https://github.com/your-username/prompt-eval-lab
cd prompt-eval-lab
npm install

# 2. Install Upstash Redis client
npm install @upstash/redis

# 3. Set environment variables
cp .env.example .env.local
# Fill in:
#   OPENAI_API_KEY=sk-...
#   KV_REST_API_URL=https://...upstash.io
#   KV_REST_API_TOKEN=...

# 4. Run locally (Vercel CLI handles /api/* routing)
npm install -g vercel
vercel dev
```

> Without `KV_REST_API_URL` and `KV_REST_API_TOKEN`, the app runs fine — the experiments API degrades gracefully (GET returns `[]`, POST returns `503`).

---

## Deployment

```bash
# Link to Vercel and deploy
vercel

# In the Vercel dashboard:
# 1. Project Settings → Environment Variables → add:
#      OPENAI_API_KEY
#      KV_REST_API_URL
#      KV_REST_API_TOKEN
#
# 2. Storage → Upstash Redis → Create → Link to this project
#    (Vercel auto-injects KV_REST_API_URL and KV_REST_API_TOKEN)

# Push to deploy
git push origin main
```

---

## Design decisions worth noting

**Why LLM-as-judge instead of rule-based scoring?**
Rule-based scoring (keyword matching, length checks, JSON validity) can catch structural failures but cannot assess semantic quality. An LLM judge evaluates whether an answer is *actually correct and relevant*, not just whether it *looks* correct. The tradeoff is a second API call per evaluation — mitigated by always using `gpt-4o-mini` at `temperature: 0` for speed and consistency.

**Why not stream responses?**
Streaming would improve perceived latency but complicates the scoring flow — you can't score a partial response. The current synchronous flow (run → complete → score) keeps the UX straightforward and the code simple.

**Why a Redis list instead of a database?**
The data model is simple and append-heavy (always add to head, read from head, occasionally delete). A Redis list with `lpush`/`lrange`/`ltrim` handles this perfectly with zero schema design and zero migrations. Upstash's HTTP REST API also means no persistent connections to manage in a serverless environment.

**Why no authentication?**
This is a personal portfolio tool. The API key is protected server-side; the Redis data is non-sensitive experiment results. Adding auth would add complexity without meaningful security benefit for this use case.

---

## Roadmap

- [ ] Side-by-side A/B comparison view (two strategies, same task, same model)
- [ ] Export experiments as CSV / JSON
- [ ] Add Claude and Gemini model support alongside OpenAI
- [ ] Per-strategy aggregate stats (average score per strategy across all experiments)
- [ ] Prompt template editor — modify strategy templates directly in the UI

---

## License

MIT — use freely, attribution appreciated.

---

*Built to demonstrate that prompt engineering is a measurable discipline, not a dark art.*
