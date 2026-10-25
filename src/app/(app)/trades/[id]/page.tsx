"use client";

import { TradeForm } from "@/components/TradeForm";
import { Banner, Button, Spinner } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { formatMoney, formatR, formatWhen, pnlClass } from "@/lib/format";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [trade, setTrade] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiJson<{ trade: any }>(`/api/trades/${id}`, { signal: controller.signal })
      .then((data) => setTrade(data.trade))
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Could not load trade");
        }
      });
    return () => controller.abort();
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <Banner tone="warn">{error}</Banner>
        <Link href="/journal" className="btn btn-ghost">Back to journal</Link>
      </div>
    );
  }
  if (!trade) return <Spinner />;

  async function remove() {
    if (!confirm("Delete this trade? This cannot be undone.")) return;
    try {
      await apiJson(`/api/trades/${id}`, { method: "DELETE" });
      router.push("/journal");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete trade");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{trade.displayId}</p>
          <h1 className="text-2xl font-semibold">{trade.instrument} {trade.direction}</h1>
          <p className="text-sm text-[var(--muted)]">
            {formatWhen(trade.entryAt)} → {formatWhen(trade.exitAt)} · {trade.session}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setEditing((value) => !value)}>{editing ? "Close editor" : "Edit"}</Button>
          <Button variant="danger" onClick={remove}>Delete</Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card-quiet p-4"><p className="text-xs text-[var(--muted)]">Net P&L</p><p className={`font-mono-num text-xl ${pnlClass(trade.netPnl)}`}>{formatMoney(trade.netPnl)}</p></div>
        <div className="card-quiet p-4"><p className="text-xs text-[var(--muted)]">R</p><p className="font-mono-num text-xl">{formatR(trade.rMultiple)}</p></div>
        <div className="card-quiet p-4"><p className="text-xs text-[var(--muted)]">Result</p><p className="text-xl capitalize">{trade.result}</p></div>
        <div className="card-quiet p-4"><p className="text-xs text-[var(--muted)]">Plan</p><p className="text-xl">{trade.followedPlan ? "Followed" : "Broke"}</p></div>
      </div>
      {trade.notes ? <Banner>{trade.notes}</Banner> : null}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(trade.screenshots || []).map((screenshot: any) => (
          <button key={screenshot.id} onClick={() => setZoom(screenshot.id)} className="card-quiet overflow-hidden text-left">
            <Image
              src={`/api/screenshots/${screenshot.id}`}
              alt={screenshot.caption || screenshot.category}
              width={640}
              height={320}
              unoptimized
              className="h-40 w-full object-cover"
            />
            <p className="px-3 py-2 text-xs text-[var(--muted)]">{screenshot.category} {screenshot.caption}</p>
          </button>
        ))}
      </div>
      {zoom ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6" onClick={() => setZoom(null)}>
          <Image
            src={`/api/screenshots/${zoom}`}
            alt="Expanded chart screenshot"
            width={1600}
            height={1200}
            unoptimized
            className="h-auto max-h-full w-auto max-w-full rounded-xl"
          />
        </div>
      ) : null}
      {trade.psychology ? (
        <section className="card p-5 text-sm">
          <h2 className="mb-2 font-semibold">Psychology</h2>
          <p>Before {trade.psychology.emotionBefore} · during {trade.psychology.emotionDuring} · after {trade.psychology.emotionAfter}</p>
          <p className="mt-2 text-[var(--muted)]">{trade.psychology.reflection || trade.psychology.lessons}</p>
        </section>
      ) : null}
      {editing ? (
        <TradeForm
          tradeId={id}
          onSaved={(updated) => {
            setTrade((current: any) => ({ ...current, ...updated }));
            setEditing(false);
          }}
        />
      ) : null}
    </div>
  );
}
