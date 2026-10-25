"use client";

import { TradeForm } from "@/components/TradeForm";
import { Banner, Button, Spinner, Stat } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { formatMoney, formatR, formatWhen } from "@/lib/format";
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
    <div className="space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow mb-3">Trade docket / {trade.displayId}</p>
          <h1 className="capitalize">{trade.instrument} {trade.direction}</h1>
          <p className="page-description">{formatWhen(trade.entryAt)} → {formatWhen(trade.exitAt)} · {trade.session}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/journal" className="btn btn-ghost">Back to journal</Link>
          <Button variant="ghost" onClick={() => setEditing((value) => !value)}>{editing ? "Close editor" : "Edit"}</Button>
          <Button variant="danger" onClick={remove}>Delete</Button>
        </div>
      </div>
      <div className="stats-grid grid-cols-2 lg:grid-cols-4">
        <Stat label="Net P&L" value={formatMoney(trade.netPnl)} tone={Number(trade.netPnl) >= 0 ? "up" : "down"} />
        <Stat label="R multiple" value={formatR(trade.rMultiple)} />
        <Stat label="Result" value={<span className="capitalize">{trade.result}</span>} />
        <Stat label="Plan" value={trade.followedPlan ? "Followed" : "Broke"} />
      </div>
      {trade.notes ? <aside className="paper-docket p-6 sm:p-8"><p className="eyebrow mb-3">Trader&apos;s note</p><p className="max-w-4xl font-serif text-xl leading-8">{trade.notes}</p></aside> : null}
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
            className="h-auto max-h-full w-auto max-w-full border border-[var(--line-strong)]"
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
