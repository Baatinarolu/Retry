"use client";

import { Banner, Button, Card, Field, Spinner, Textarea } from "@/components/ui";
import { useEffect, useState } from "react";

export default function AiCoachPage() {
  const [question, setQuestion] = useState("");
  const [review, setReview] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/ai").then((r) => r.json()).then((d) => setHistory(d.reviews || []));
    fetch("/api/settings").then((r) => r.json()).then((d) => setPermission(Boolean(d.user?.aiPermission)));
  }, []);

  async function run(type: string) {
    setLoading(true);
    setError("");
    try {
      const now = new Date();
      const body: { type: string; question: string; from?: string; to?: string } = { type, question };
      if (type === "weekly" || type === "monthly") {
        const from = new Date(now);
        if (type === "weekly") from.setUTCDate(from.getUTCDate() - 6);
        else from.setUTCDate(1);
        body.from = from.toISOString().slice(0, 10);
        body.to = now.toISOString().slice(0, 10);
      }
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate review");
      setReview(data.review);
      if (data.review) setHistory((current) => [data.review, ...current]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate review");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">AI Coach</h1>
        <p className="text-sm text-[var(--muted)]">
          Reviews use your journal statistics. The server can use a local Ollama model with free rule-based fallback. They cannot predict markets or promise profitability.
        </p>
      </div>
      {error ? <Banner tone="warn">{error}</Banner> : null}
      {!permission ? (
        <Banner tone="warn">
          AI language models are off until you enable AI permission in Settings. Rule-based coaching still works and never leaves this app.
        </Banner>
      ) : (
        <Banner>AI permission is enabled. Local Ollama keeps summaries on its host; an external provider is used only if the server is configured for one.</Banner>
      )}
      <Card className="space-y-3">
        <Field label="Ask about your journal">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Why am I repeatedly losing on US30? Which ICT setups performed best? Do I move stops?"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button loading={loading} onClick={() => run("review")}>Review sample</Button>
          <Button variant="ghost" loading={loading} onClick={() => run("weekly")}>Weekly</Button>
          <Button variant="ghost" loading={loading} onClick={() => run("monthly")}>Monthly</Button>
          <Button variant="ghost" loading={loading} onClick={() => run("psychology")}>Psychology</Button>
        </div>
      </Card>
      {review ? (
        <Card>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            {review.source === "llm" ? "AI model" : "Rule-based"} · n={review.sampleSize}
          </p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6">{review.content}</pre>
        </Card>
      ) : loading ? (
        <Spinner label="Analyzing journal facts" />
      ) : null}
      <Card>
        <h2 className="mb-3 font-semibold">History</h2>
        <ul className="space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.id}>
              <button className="text-left text-teal-300" onClick={() => setReview(h)}>
                {h.type} · {new Date(h.createdAt).toLocaleString()} · {h.source}
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
