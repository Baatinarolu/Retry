import assert from "node:assert/strict";
import test from "node:test";
import { generateCoachReview } from "../src/lib/coach";

test("local Ollama is the default key-free AI provider", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ message: { content: "Local coaching review" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await generateCoachReview({
    facts: "Sample: 5 trades",
    question: "What should I review?",
    permission: true,
    env: { OLLAMA_BASE_URL: "http://127.0.0.1:11434/", OLLAMA_MODEL: "qwen2.5:3b" },
    fetchImpl,
  });

  assert.equal(result.source, "llm");
  assert.equal(result.provider, "ollama");
  assert.equal(result.content, "Local coaching review");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:11434/api/chat");
  assert.equal(calls[0].body.model, "qwen2.5:3b");
  assert.equal(calls[0].body.stream, false);
});

test("AI permission prevents model calls and preserves rule-based coaching", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    throw new Error("should not be called");
  };
  const result = await generateCoachReview({
    facts: "Journal facts",
    question: "",
    permission: false,
    env: { AI_PROVIDER: "ollama" },
    fetchImpl,
  });

  assert.equal(called, false);
  assert.equal(result.source, "rules");
  assert.match(result.content, /Journal facts/);
  assert.match(result.content, /Enable AI permission/);
});

test("an unavailable local model falls back safely without exposing errors", async () => {
  const fetchImpl: typeof fetch = async () => new Response("unavailable", { status: 503 });
  const result = await generateCoachReview({
    facts: "Journal facts",
    question: "",
    permission: true,
    env: { AI_PROVIDER: "ollama" },
    fetchImpl,
  });

  assert.equal(result.source, "rules");
  assert.equal(result.provider, "ollama");
  assert.match(result.content, /Local Ollama was unavailable/);
  assert.match(result.content, /Journal facts/);
});

test("rules-only mode never calls a language model", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    return new Response();
  };
  const result = await generateCoachReview({
    facts: "Journal facts",
    question: "",
    permission: true,
    env: { AI_PROVIDER: "rules", OPENAI_API_KEY: "unused" },
    fetchImpl,
  });

  assert.equal(called, false);
  assert.deepEqual(result, { content: "Journal facts", source: "rules", provider: "rules" });
});

test("Vercel defaults to rules unless an AI provider is explicitly configured", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    return new Response();
  };
  const result = await generateCoachReview({
    facts: "Journal facts",
    question: "",
    permission: true,
    env: { VERCEL: "1" },
    fetchImpl,
  });

  assert.equal(called, false);
  assert.deepEqual(result, { content: "Journal facts", source: "rules", provider: "rules" });
});
