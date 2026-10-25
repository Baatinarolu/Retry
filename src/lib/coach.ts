export type CoachProvider = "rules" | "ollama" | "openai";

export type CoachResult = {
  content: string;
  source: "rules" | "llm";
  provider: CoachProvider;
};

type CoachInput = {
  facts: string;
  question: string;
  permission: boolean;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
};

const SYSTEM_PROMPT =
  "You are TradeMind Coach, a trading journal analyst. Use only the provided journal statistics. Never invent trades, prices, or news. Never promise profits. Never encourage martingale, revenge trading, or uncontrolled leverage. Distinguish facts from hypotheses. If sample size is small, say so. Do not give live buy/sell signals.";

function userPrompt(facts: string, question: string) {
  return `${facts}\n\nWrite a concise coaching review with facts vs hypotheses, then 5 process questions. User question: ${question || "(none)"}`;
}

function fallback(facts: string, provider: CoachProvider, note?: string): CoachResult {
  return { content: `${facts}${note ? `\n\n${note}` : ""}`, source: "rules", provider };
}

async function requestOllama(
  facts: string,
  question: string,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
) {
  const baseUrl = (env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
  const response = await fetchImpl(`${baseUrl}/api/chat`, {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL || "qwen2.5:3b",
      stream: false,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(facts, question) },
      ],
      options: { temperature: 0.2, num_predict: 700 },
    }),
  });
  if (!response.ok) throw new Error("Ollama request failed");
  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content?.trim();
  if (!content) throw new Error("Ollama returned an empty review");
  return content;
}

async function requestOpenAi(
  facts: string,
  question: string,
  apiKey: string,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
) {
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(facts, question) },
      ],
    }),
  });
  if (!response.ok) throw new Error("OpenAI request failed");
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty review");
  return content;
}

export async function generateCoachReview({
  facts,
  question,
  permission,
  env = process.env,
  fetchImpl = fetch,
}: CoachInput): Promise<CoachResult> {
  const defaultProvider = env.VERCEL === "1" || env.VERCEL_ENV ? "rules" : "ollama";
  const requested = (env.AI_PROVIDER || defaultProvider).trim().toLowerCase();
  if (requested === "rules") return fallback(facts, "rules");
  if (requested !== "ollama" && requested !== "openai") {
    return fallback(facts, "rules", "AI_PROVIDER is not recognized, so this review uses rule-based coaching.");
  }
  if (!permission) {
    return fallback(
      facts,
      requested,
      "The AI model was not used. Enable AI permission in Settings; rule-based coaching remains available without it.",
    );
  }
  if (requested === "openai" && !env.OPENAI_API_KEY) {
    return fallback(facts, requested, "OPENAI_API_KEY is not configured, so this review uses rule-based coaching.");
  }

  try {
    const content = requested === "ollama"
      ? await requestOllama(facts, question, env, fetchImpl)
      : await requestOpenAi(facts, question, env.OPENAI_API_KEY!, env, fetchImpl);
    return { content, source: "llm", provider: requested };
  } catch {
    return fallback(
      facts,
      requested,
      requested === "ollama"
        ? "Local Ollama was unavailable, so this review uses free rule-based coaching. Start Ollama and pull the configured model to enable local AI."
        : "The external AI provider was unavailable, so this review uses rule-based coaching.",
    );
  }
}
