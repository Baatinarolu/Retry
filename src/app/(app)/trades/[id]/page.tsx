"use client";

import { TradeForm } from "@/components/TradeForm";
import { ExecutionReviewPanel } from "@/components/ExecutionReviewPanel";
import { PricePathPanel } from "@/components/PricePathPanel";
import { RiskLevelsPanel } from "@/components/RiskLevelsPanel";
import { ReverseTradePanel } from "@/components/ReverseTradePanel";
import { ScreenshotGallery, ScreenshotLightbox, type TradeScreenshot } from "@/components/ScreenshotGallery";
import { ScreenshotUploader } from "@/components/ScreenshotUploader";
import { TradeReviewPanel } from "@/components/TradeReviewPanel";
import { TradeTimeline } from "@/components/TradeTimeline";
import { Banner, Button, Spinner, Stat } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { formatMoney, formatR, formatWhen } from "@/lib/format";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type SetStateAction } from "react";

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

  function changeScreenshots(update: SetStateAction<TradeScreenshot[]>) {
    setTrade((current: any) => {
      if (!current) return current;
      const screenshots = current.screenshots || [];
      return { ...current, screenshots: typeof update === "function" ? update(screenshots) : update };
    });
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Banner tone="warn">{error}</Banner>
        <Link href="/journal" className="btn btn-ghost">Back to journal</Link>
      </div>
    );
  }
  if (!trade) return <Spinner />;
  const currency = trade.accountCurrency || "USD";

  async function uploadShot(file: File, category: string, caption: string) {
    const data = new FormData();
    data.set("file", file);
    data.set("category", category);
    data.set("caption", caption);
    const result = await apiJson<{ screenshot: TradeScreenshot }>(`/api/trades/${id}/screenshots`, { method: "POST", body: data });
    changeScreenshots((current) => [...current, result.screenshot]);
    setError("");
  }

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
          <p className="page-description">{formatWhen(trade.entryAt)} → {formatWhen(trade.realizedAt ?? trade.exitAt)} · {trade.session}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/journal" className="btn btn-ghost">Back to journal</Link>
          <a href="#chart-screenshots" className="btn btn-ghost">Add images</a>
          <Button variant="ghost" onClick={() => setEditing((value) => !value)}>{editing ? "Close editor" : "Edit"}</Button>
          <Button variant="danger" onClick={remove}>Delete</Button>
        </div>
      </div>
      <div className="stats-grid grid-cols-2 lg:grid-cols-4">
        <Stat label="Net P&L" value={formatMoney(trade.netPnl, currency)} tone={Number(trade.netPnl) >= 0 ? "up" : "down"} />
        <Stat label="R multiple" value={formatR(trade.rMultiple)} />
        <Stat label="Result" value={<span className="capitalize">{trade.result}</span>} />
        <Stat label="Plan" value={trade.followedPlan ? "Followed" : "Broke"} />
      </div>
      {trade.reversalSource ? (
        <Banner>Reversal from <Link className="underline" href={`/trades/${trade.reversalSource.id}`}>{trade.reversalSource.displayId}</Link> · {trade.reversalSource.direction} → {trade.direction}</Banner>
      ) : null}
      {trade.reversalTarget ? (
        <Banner>Reversed to <Link className="underline" href={`/trades/${trade.reversalTarget.id}`}>{trade.reversalTarget.displayId}</Link> · {trade.direction} → {trade.reversalTarget.direction}</Banner>
      ) : null}
      <TradeTimeline trade={trade} currency={currency} onOpenScreenshot={setZoom} />
      {trade.executionReview ? <ExecutionReviewPanel review={trade.executionReview} currency={currency} /> : null}
      {trade.status === "open" && trade.executions?.length ? (
        <ReverseTradePanel tradeId={id} direction={trade.direction} remainingQuantity={trade.positionSize} />
      ) : null}
      {trade.executionReview ? (
        <PricePathPanel
          tradeId={id}
          points={trade.pricePath || []}
          onSaved={(pricePath) => {
            setTrade((current: any) => ({ ...current, pricePath }));
            apiJson<{ trade: any }>(`/api/trades/${id}`)
              .then((data) => setTrade(data.trade))
              .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Path saved, but review data could not be refreshed"));
          }}
        />
      ) : null}
      <RiskLevelsPanel
        tradeId={id}
        levels={trade.riskLevels || []}
        onSaved={(riskLevels) => setTrade((current: any) => ({ ...current, riskLevels }))}
      />
      <TradeReviewPanel
        trade={trade}
        onSaved={(review) => setTrade((current: any) => ({ ...current, ...review }))}
      />
      {trade.executions?.length ? (
        <section className="card overflow-hidden">
          <div className="card-heading px-5 pt-5"><h2>Execution ledger</h2><span>{trade.executions.length} fills</span></div>
          <div className="table-wrap mt-4">
            <table className="data">
              <thead><tr><th>Type</th><th>Time</th><th>Price</th><th>Quantity</th><th>Fees</th></tr></thead>
              <tbody>
                {trade.executions.map((execution: any) => (
                  <tr key={execution.id}>
                    <td className="capitalize">{execution.type.replace("_", " ")}</td>
                    <td>{formatWhen(execution.executedAt)}</td>
                    <td className="font-mono-num">{execution.price}</td>
                    <td className="font-mono-num">{execution.quantity}</td>
                    <td className="font-mono-num">{formatMoney(execution.fees, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {trade.notes ? <aside className="paper-docket p-6 sm:p-8"><p className="eyebrow mb-3">Trader&apos;s note</p><p className="max-w-4xl font-serif text-xl leading-8">{trade.notes}</p></aside> : null}
      <section id="chart-screenshots" className="card space-y-4 scroll-mt-24 p-5">
        <div className="card-heading">
          <div><p className="eyebrow mb-2">Visual evidence</p><h2>Chart screenshots</h2></div>
          <span>{(trade.screenshots || []).length} images</span>
        </div>
        <ScreenshotUploader onUpload={uploadShot} />
        {!(trade.screenshots || []).length ? <p className="text-sm text-[var(--muted)]">No chart images yet. Add before-entry, entry, management, or exit evidence above.</p> : null}
        <ScreenshotGallery
          screenshots={trade.screenshots || []}
          onUpdated={(updated) => changeScreenshots((current) => current.map((shot) => shot.id === updated.id ? updated : shot))}
          onDeleted={(deletedId) => changeScreenshots((current) => current.filter((shot) => shot.id !== deletedId))}
          onZoom={setZoom}
        />
      </section>
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
          screenshots={trade.screenshots || []}
          onScreenshotsChanged={changeScreenshots}
          onSaved={(updated) => {
            setTrade((current: any) => ({ ...current, ...updated }));
            setEditing(false);
            apiJson<{ trade: any }>(`/api/trades/${id}`)
              .then((data) => setTrade(data.trade))
              .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Trade saved, but review data could not be refreshed"));
          }}
        />
      ) : null}
      <ScreenshotLightbox screenshotId={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
