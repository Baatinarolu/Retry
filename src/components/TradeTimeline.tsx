"use client";

import { Badge } from "@/components/ui";
import { formatWhen } from "@/lib/format";
import { buildTradeTimeline, type TradeTimelineEvent, type TradeTimelineInput } from "@/lib/trade-timeline";
import Image from "next/image";
import { useMemo } from "react";

const kindLabels: Record<TradeTimelineEvent["kind"], string> = {
  execution: "Execution",
  price: "Price record",
  risk: "Risk plan",
  screenshot: "Image upload",
};

export function TradeTimeline({
  trade,
  currency,
  onOpenScreenshot,
}: {
  trade: TradeTimelineInput;
  currency: string;
  onOpenScreenshot: (id: string) => void;
}) {
  const events = useMemo(() => buildTradeTimeline(trade, currency), [trade, currency]);

  return (
    <section id="review-timeline" className="card scroll-mt-24 p-5">
      <div className="card-heading">
        <div>
          <p className="eyebrow mb-2">Chronological review</p>
          <h2>Trade timeline</h2>
        </div>
        <span>{events.length} events</span>
      </div>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--muted)]">
        Fills, recorded prices, and manual stop/target snapshots use their recorded timestamps. Images appear at upload time because capture time is not known. This display never changes execution accounting or market-path metrics.
      </p>
      {!events.length ? (
        <p className="card-quiet mt-5 p-4 text-sm text-[var(--muted)]">No dated review events are available yet.</p>
      ) : (
        <ol className="mt-6">
          {events.map((event) => (
            <li key={event.id} className="relative border-l border-[var(--line-strong)] pb-6 pl-5 last:pb-0">
              <span aria-hidden="true" className="absolute -left-[4px] top-2 h-[7px] w-[7px] rounded-full bg-[var(--accent)]" />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge>{kindLabels[event.kind]}</Badge>
                <time dateTime={event.at} className="font-mono-num text-xs text-[var(--muted)]">{formatWhen(event.at)}</time>
              </div>
              <h3 className="mt-2 text-xl">{event.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{event.detail}</p>
              {event.notes ? <p className="mt-2 max-w-4xl whitespace-pre-wrap text-sm leading-6">{event.notes}</p> : null}
              {event.screenshot ? (
                <button type="button" className="card-quiet mt-3 block overflow-hidden" onClick={() => onOpenScreenshot(event.screenshot!.id)} aria-label={`Expand ${event.screenshot.caption || event.screenshot.category} image`}>
                  <Image
                    src={`/api/screenshots/${event.screenshot.id}`}
                    alt={event.screenshot.caption || event.screenshot.category}
                    width={192}
                    height={112}
                    unoptimized
                    className="h-24 w-40 object-cover"
                  />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
