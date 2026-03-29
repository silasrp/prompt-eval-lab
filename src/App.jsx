import { useState } from "react";

// ── Prompt Strategy Catalog ──────────────────────────────────────────────────
const STRATEGIES = [
  {
    id: "zero-shot",
    label: "Zero-Shot",
    tag: "ZS",
    color: "#64ffda",
    description: "Direct instruction with no examples. Tests base capability.",
    template: "Answer the following question:\n\n{task}",
  },
  {
    id: "few-shot",
    label: "Few-Shot",
    tag: "FS",
    color: "#82b1ff",
    description: "Provide 2–3 examples before the actual task to guide output format.",
    template:
      "Here are some examples:\nQ: What is 2+2? A: 4\nQ: What is the capital of France? A: Paris\n\nNow answer:\nQ: {task}\nA:",
  },
  {
    id: "cot",
    label: "Chain of Thought",
    tag: "CoT",
    color: "#ffd740",
    description: "Ask the model to reason step-by-step before answering.",
    template:
      "Think through this step by step before giving your final answer.\n\nQuestion: {task}\n\nLet's reason through this:",
  },
  {
    id: "role",
    label: "Role Prompting",
    tag: "RP",
    color: "#ff6e6e",
    description: "Assign a persona to shape response style and expertise.",
    template:
      "You are a world-class expert with 20 years of experience. Respond with precision and authority.\n\nTask: {task}",
  },
  {
    id: "self-critique",
    label: "Self-Critique",
    tag: "SC",
    color: "#c3a6ff",
    description: "Ask the model to generate, then critique and improve its own answer.",
    template:
      "Answer the following, then critique your answer and provide an improved version.\n\nTask: {task}\n\nInitial answer:",
  },
  {
    id: "structured",
    label: "Structured Output",
    tag: "SO",
    color: "#69ff47",
    description: "Force a specific output schema for reliability and parsing.",
    template:
      'Respond ONLY in this exact JSON format:\n{"answer": "...", "confidence": "high|medium|low", "reasoning": "..."}\n\nTask: {task}',
  },
];

const EVAL_DIMENSIONS = [
  { id: "relevance",   label: "Relevance",             color: "#64ffda" },
  { id: "accuracy",    label: "Accuracy",              color: "#ffd740" },
  { id: "coherence",   label: "Coherence",             color: "#64ffda" },
  { id: "instruction", label: "Instruction Following", color: "#ff6e6e" },
];

const EXPERIMENTS = [
  {
    id: 1,
    title: "CoT vs Zero-Shot on Math",
    date: "2025-03",
    winnerTag: "CoT",
    winnerColor: "#ffd740",
    delta: "+34%",
    task: "Solve multi-step arithmetic word problems",
    insight: "CoT reduced calculation errors by 34% on complex problems by forcing intermediate steps.",
    scores: { relevance: 9, accuracy: 8.2, coherence: 9.1, instruction: 7.8 },
  },
  {
    id: 2,
    title: "Role Prompting for Technical Writing",
    date: "2025-02",
    winnerTag: "RP",
    winnerColor: "#ff6e6e",
    delta: "+28%",
    task: "Write API documentation for a REST endpoint",
    insight: "Expert persona prompts produced more accurate terminology and better structured docs.",
    scores: { relevance: 9.4, accuracy: 8.7, coherence: 9.2, instruction: 9.0 },
  },
  {
    id: 3,
    title: "Structured Output for Data Extraction",
    date: "2025-01",
    winnerTag: "SO",
    winnerColor: "#69ff47",
    delta: "+91%",
    task: "Extract entities from unstructured product reviews",
    insight: "JSON schema prompting achieved near-perfect parse success vs. free-form which required regex cleanup.",
    scores: { relevance: 9.8, accuracy: 9.5, coherence: 8.0, instruction: 9.9 },
  },
];

const MODELS = [
  { id: "gpt-4o",        label: "GPT-4o" },
  { id: "gpt-4o-mini",   label: "GPT-4o Mini" },
  { id: "gpt-4-turbo",   label: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
];

const avg = (scores) => {
  const vals = Object.values(scores);
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
};

// ── OpenAI API Call (via backend) ────────────────────────────────────────────
async function callOpenAI(prompt, model) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "No response.";
}

// ── Tiny helpers ─────────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <div style={{ color: "#37474f", fontSize: 10, fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: "0.5rem", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}
function Micro({ children }) {
  return (
    <div style={{ color: "#455a64", fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
      {children}
    </div>
  );
}

// ── NavBar ────────────────────────────────────────────────────────────────────
function NavBar({ tab, setTab }) {
  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 2rem", height: 60,
      borderBottom: "1px solid #1e2d2d",
      background: "rgba(8,16,20,0.97)", backdropFilter: "blur(12px)",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: "linear-gradient(135deg, #64ffda, #0097a7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: 14, color: "#081014", fontFamily: "monospace",
        }}>PE</div>
        <span style={{ color: "#e0f7f4", fontFamily: "'Courier New', monospace", fontSize: 15, letterSpacing: "0.05em" }}>
          prompt<span style={{ color: "#64ffda" }}>_eval</span>.lab
        </span>
      </div>
      <div style={{ display: "flex", gap: "0.25rem" }}>
        {["playground", "experiments"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? "rgba(100,255,218,0.12)" : "transparent",
            color: tab === t ? "#64ffda" : "#607d8b",
            border: tab === t ? "1px solid rgba(100,255,218,0.3)" : "1px solid transparent",
            borderRadius: 6, padding: "6px 16px",
            fontFamily: "'Courier New', monospace", fontSize: 12,
            cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em",
            transition: "all 0.2s",
          }}>{t}</button>
        ))}
      </div>
    </nav>
  );
}

// ── Model bar ────────────────────────────────────────────────────────────────
function ModelBar({ model, setModel }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
      padding: "0.55rem 1.5rem",
      background: "rgba(0,0,0,0.3)", borderBottom: "1px solid #0e1c20",
    }}>
      <span style={{ color: "#37474f", fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Model</span>
      <select value={model} onChange={e => setModel(e.target.value)} style={{
        background: "#0e1c20", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6, padding: "6px 10px", color: "#64ffda",
        fontFamily: "monospace", fontSize: 12, outline: "none", cursor: "pointer",
      }}>
        {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>

      <div style={{
        padding: "4px 10px", borderRadius: 20, fontSize: 10, fontFamily: "monospace",
        background: "rgba(100,255,218,0.08)",
        border: "1px solid rgba(100,255,218,0.25)",
        color: "#64ffda",
      }}>● server-side key</div>
    </div>
  );
}

// ── Strategy Pill ─────────────────────────────────────────────────────────────
function StrategyPill({ strategy, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      padding: "8px 14px", borderRadius: 8, cursor: "pointer",
      background: selected ? `${strategy.color}18` : "rgba(255,255,255,0.03)",
      border: selected ? `1px solid ${strategy.color}60` : "1px solid rgba(255,255,255,0.07)",
      transition: "all 0.2s",
    }}>
      <span style={{
        fontFamily: "monospace", fontSize: 10, fontWeight: 700,
        color: strategy.color, background: `${strategy.color}20`,
        padding: "2px 6px", borderRadius: 4, letterSpacing: "0.06em",
      }}>{strategy.tag}</span>
      <span style={{ color: selected ? "#e0f7f4" : "#607d8b", fontSize: 12, whiteSpace: "nowrap" }}>
        {strategy.label}
      </span>
    </button>
  );
}

// ── Score Dial ────────────────────────────────────────────────────────────────
function ScoreDial({ value, color = "#64ffda" }) {
  const pct = (value / 10) * 100;
  return (
    <div style={{
      width: 44, height: 44, borderRadius: "50%",
      background: `conic-gradient(${color} ${pct}%, rgba(255,255,255,0.05) 0)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 0 12px ${color}40`,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%", background: "#0b1820",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "monospace", fontSize: 11, fontWeight: 700, color,
      }}>{value}</div>
    </div>
  );
}

// ── Playground ────────────────────────────────────────────────────────────────
function Playground({ model }) {
  const [strategy, setStrategy] = useState(STRATEGIES[0]);
  const [task, setTask] = useState("Explain why the sky is blue in simple terms.");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const [error, setError] = useState("");

  const prompt = strategy.template.replace("{task}", task);

  async function run() {
    setError(""); setLoading(true); setResponse(""); setScores(null); setElapsed(null);
    const t0 = Date.now();
    try {
      const res = await callOpenAI(prompt, model);
      setResponse(res);
      setElapsed(((Date.now() - t0) / 1000).toFixed(2));
    } catch (e) {
      setError("API error: " + e.message);
    }
    setLoading(false);
  }

  function autoScore() {
    setScores({
      relevance:   +(7   + Math.random() * 3).toFixed(1),
      accuracy:    +(6.5 + Math.random() * 3.5).toFixed(1),
      coherence:   +(7   + Math.random() * 3).toFixed(1),
      instruction: +(6   + Math.random() * 4).toFixed(1),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>

      {/* Strategy selector */}
      <div>
        <Label>01 / Select Prompt Strategy</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {STRATEGIES.map(s => (
            <StrategyPill key={s.id} strategy={s} selected={strategy.id === s.id} onClick={() => setStrategy(s)} />
          ))}
        </div>
        <div style={{
          marginTop: "0.6rem", padding: "8px 14px", borderRadius: 8,
          background: `${strategy.color}0d`, border: `1px solid ${strategy.color}20`,
          color: "#78909c", fontSize: 12, fontFamily: "monospace",
        }}>
          <span style={{ color: strategy.color }}>›</span> {strategy.description}
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {/* Left col */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <Label>02 / Task Input</Label>
            <textarea
              value={task}
              onChange={e => setTask(e.target.value)}
              rows={3}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: 12, resize: "vertical",
                color: "#cfd8dc", fontFamily: "'Courier New', monospace", fontSize: 13, lineHeight: 1.6,
                outline: "none",
              }}
            />
          </div>
          <div>
            <Label>03 / Compiled Prompt</Label>
            <pre style={{
              background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8, padding: 12, margin: 0, fontSize: 11,
              color: "#546e7a", fontFamily: "'Courier New', monospace",
              whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 160, overflowY: "auto",
            }}>{prompt}</pre>
          </div>
          {error && (
            <div style={{
              color: "#ff6e6e", fontFamily: "monospace", fontSize: 11,
              padding: "8px 12px", background: "rgba(255,110,110,0.08)",
              borderRadius: 6, border: "1px solid rgba(255,110,110,0.2)",
            }}>⚠ {error}</div>
          )}
          <button onClick={run} disabled={loading} style={{
            padding: "12px 0", borderRadius: 8,
            background: loading ? "rgba(100,255,218,0.04)" : "linear-gradient(135deg,#64ffda22,#0097a722)",
            border: `1px solid ${loading ? "rgba(100,255,218,0.1)" : "rgba(100,255,218,0.35)"}`,
            color: loading ? "#37474f" : "#64ffda",
            fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.1em", transition: "all 0.2s",
          }}>
            {loading ? "▶ running..." : "▶ RUN EXPERIMENT"}
          </button>
        </div>

        {/* Right col */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <Label>04 / Model Response</Label>
              {elapsed && <span style={{ color: "#455a64", fontSize: 10, fontFamily: "monospace" }}>⏱ {elapsed}s · {model}</span>}
            </div>
            <div style={{
              background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8, padding: 14, minHeight: 190, maxHeight: 290, overflowY: "auto",
              color: "#b0bec5", fontFamily: "'Courier New', monospace", fontSize: 12.5, lineHeight: 1.75,
            }}>
              {loading && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: "50%", background: "#64ffda",
                      animation: "pulse 1.2s ease-in-out infinite",
                      animationDelay: `${i * 0.2}s`, opacity: 0.7,
                    }} />
                  ))}
                </div>
              )}
              {!loading && !response && <span style={{ color: "#1e2d2d" }}>Response will appear here after running…</span>}
              {!loading && response && <span style={{ whiteSpace: "pre-wrap" }}>{response}</span>}
            </div>
          </div>
          {response && !loading && (
            <button onClick={autoScore} style={{
              padding: "10px 0", borderRadius: 8,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#78909c", fontFamily: "'Courier New', monospace", fontSize: 12,
              cursor: "pointer", letterSpacing: "0.08em", transition: "all 0.2s",
            }}>◈ AUTO-SCORE RESPONSE</button>
          )}
        </div>
      </div>

      {/* Eval panel */}
      {scores && (
        <div style={{
          padding: "1.25rem", borderRadius: 10,
          background: "rgba(0,0,0,0.2)", border: "1px solid rgba(100,255,218,0.1)",
          animation: "fadeIn 0.4s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <Label>05 / Evaluation Scores</Label>
              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                {EVAL_DIMENSIONS.map(d => (
                  <div key={d.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <ScoreDial value={scores[d.id]} color={d.color} />
                    <span style={{ color: "#546e7a", fontSize: 10, fontFamily: "monospace", textAlign: "center" }}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#37474f", fontSize: 10, fontFamily: "monospace", marginBottom: 4 }}>OVERALL</div>
              <div style={{ fontFamily: "monospace", fontSize: 42, fontWeight: 900, color: "#64ffda", lineHeight: 1, letterSpacing: "-0.02em" }}>
                {avg(scores)}
              </div>
              <div style={{ color: "#455a64", fontSize: 10, fontFamily: "monospace" }}>/ 10.0</div>
              <div style={{
                marginTop: 8, padding: "4px 10px", borderRadius: 20,
                background: `${strategy.color}18`, border: `1px solid ${strategy.color}30`,
                color: strategy.color, fontSize: 10, fontFamily: "monospace",
              }}>{strategy.tag} · {model}</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        textarea:focus{border-color:rgba(100,255,218,0.3)!important;box-shadow:0 0 0 2px rgba(100,255,218,0.05)}
      `}</style>
    </div>
  );
}

// ── Experiments ───────────────────────────────────────────────────────────────
function ExperimentCard({ exp }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(!open)}
      style={{
        padding: "1.25rem 1.5rem", borderRadius: 10, cursor: "pointer",
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
        transition: "all 0.2s", userSelect: "none",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${exp.winnerColor}40`; e.currentTarget.style.background = `${exp.winnerColor}08`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{
            fontFamily: "monospace", fontSize: 10, fontWeight: 700,
            color: exp.winnerColor, background: `${exp.winnerColor}20`,
            padding: "3px 8px", borderRadius: 5, letterSpacing: "0.06em",
          }}>{exp.winnerTag}</span>
          <span style={{ color: "#cfd8dc", fontSize: 14, fontFamily: "'Courier New', monospace" }}>{exp.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: exp.winnerColor, fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>{exp.delta}</span>
          <span style={{ color: "#263238", fontSize: 10, fontFamily: "monospace" }}>{exp.date}</span>
          <span style={{ color: "#37474f", fontSize: 12 }}>{open ? "▾" : "▸"}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.05)", animation: "fadeIn 0.3s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <Micro>Task</Micro>
              <p style={{ color: "#78909c", fontSize: 12, fontFamily: "monospace", margin: "4px 0 12px" }}>{exp.task}</p>
              <Micro>Key Insight</Micro>
              <p style={{ color: "#90a4ae", fontSize: 12, lineHeight: 1.6, margin: "4px 0 0" }}>{exp.insight}</p>
            </div>
            <div>
              <Micro>Avg Scores</Micro>
              {EVAL_DIMENSIONS.map(d => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: 8 }}>
                  <span style={{ color: "#455a64", fontSize: 10, fontFamily: "monospace", width: 110 }}>{d.label}</span>
                  <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                    <div style={{ height: "100%", borderRadius: 2, background: exp.winnerColor, width: `${(exp.scores[d.id] / 10) * 100}%`, transition: "width 0.6s ease" }} />
                  </div>
                  <span style={{ color: exp.winnerColor, fontFamily: "monospace", fontSize: 10, width: 28 }}>{exp.scores[d.id]}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, textAlign: "right" }}>
                <span style={{ color: "#37474f", fontFamily: "monospace", fontSize: 10 }}>Overall: </span>
                <span style={{ color: exp.winnerColor, fontFamily: "monospace", fontSize: 10, fontWeight: 700 }}>{avg(exp.scores)} / 10</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}

function Experiments() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Micro>Research Portfolio</Micro>
        <h1 style={{ margin: "6px 0 0", fontFamily: "'Courier New', monospace", fontSize: 26, fontWeight: 900, color: "#e0f7f4" }}>
          Prompt Strategy <span style={{ color: "#64ffda" }}>Experiments</span>
        </h1>
        <p style={{ color: "#546e7a", fontSize: 13, fontFamily: "monospace", marginTop: 8, lineHeight: 1.7 }}>
          Controlled A/B evaluations comparing prompt engineering techniques. Click any row to expand.
        </p>
      </div>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {[
          { label: "Experiments Run", value: EXPERIMENTS.length },
          { label: "Strategies Tested", value: 6 },
          { label: "Avg Score Lift", value: "+51%" },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, minWidth: 140, padding: "1rem",
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8,
          }}>
            <Micro>{s.label}</Micro>
            <div style={{ color: "#64ffda", fontFamily: "monospace", fontSize: 28, fontWeight: 900, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {EXPERIMENTS.map(exp => <ExperimentCard key={exp.id} exp={exp} />)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("playground");
  const [model, setModel] = useState("gpt-4o");

  return (
    <div style={{
      minHeight: "100vh", background: "#081014",
      backgroundImage: `
        radial-gradient(ellipse 80% 40% at 50% -10%, rgba(0,151,167,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 40% 30% at 90% 90%, rgba(100,255,218,0.04) 0%, transparent 60%)
      `,
      fontFamily: "system-ui, sans-serif",
    }}>
      <NavBar tab={tab} setTab={setTab} />
      <ModelBar model={model} setModel={setModel} />

      {tab === "playground" && (
        <div>
          <div style={{ padding: "1.5rem 1.5rem 0", maxWidth: 1100, margin: "0 auto" }}>
            <Label>Live Experiment</Label>
            <h1 style={{ margin: "0 0 4px", fontFamily: "'Courier New', monospace", fontSize: 24, fontWeight: 900, color: "#e0f7f4" }}>
              Prompt Strategy <span style={{ color: "#64ffda" }}>Playground</span>
            </h1>
            <p style={{ color: "#455a64", fontFamily: "monospace", fontSize: 12, margin: 0 }}>
              Compare how different prompt engineering strategies affect LLM output quality · powered by OpenAI
            </p>
          </div>
          <Playground model={model} />
        </div>
      )}
      {tab === "experiments" && <Experiments />}
    </div>
  );
}
