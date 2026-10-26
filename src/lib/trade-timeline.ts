import { SCREENSHOT_CATEGORIES } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

type Timestamp = string | Date;

export type TimelineScreenshot = {
  id: string;
  category: string;
  caption: string;
  createdAt: Timestamp;
};

export type TradeTimelineInput = {
  entryAt: Timestamp;
  exitAt?: Timestamp | null;
  entryPrice?: string | null;
  exitPrice?: string | null;
  positionSize?: string | null;
  executions?: Array<{
    id: string;
    type: string;
    executedAt: Timestamp;
    price: string;
    quantity: string;
    fees: string;
    notes?: string | null;
  }>;
  pricePath?: Array<{
    id?: string;
    observedAt: Timestamp;
    price: string;
    notes?: string | null;
  }>;
  riskLevels?: Array<{
    id?: string;
    effectiveAt: Timestamp;
    stopLoss: string | null;
    takeProfit: string | null;
    notes?: string | null;
  }>;
  screenshots?: TimelineScreenshot[];
};

export type TradeTimelineEvent = {
  id: string;
  kind: "execution" | "price" | "risk" | "screenshot";
  at: string;
  title: string;
  detail: string;
  notes: string;
  rank: number;
  sourceIndex: number;
  screenshot?: {
    id: string;
    category: string;
    caption: string;
  };
};

function normalizedTimestamp(value: Timestamp) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function executionLabel(type: string) {
  const labels: Record<string, string> = {
    entry: "Entry fill",
    scale_in: "Scale-in fill",
    scale_out: "Scale-out fill",
    exit: "Exit fill",
  };
  return labels[type] || type.replaceAll("_", " ");
}

function screenshotLabel(category: string) {
  return SCREENSHOT_CATEGORIES.find((item) => item.value === category)?.label || "Supporting image";
}

/**
 * Builds a display-only journal index. It never feeds execution, risk, or P&L calculations.
 * Equal timestamps use deterministic source-group ordering and original source order.
 */
export function buildTradeTimeline(trade: TradeTimelineInput, currency = "USD"): TradeTimelineEvent[] {
  const events: TradeTimelineEvent[] = [];

  function add(event: Omit<TradeTimelineEvent, "at"> & { at: Timestamp }) {
    const at = normalizedTimestamp(event.at);
    if (at) events.push({ ...event, at });
  }

  const executions = trade.executions || [];
  if (executions.length) {
    executions.forEach((execution, index) => {
      add({
        id: `execution-${execution.id}`,
        kind: "execution",
        at: execution.executedAt,
        title: executionLabel(execution.type),
        detail: `Quantity ${execution.quantity} · Price ${execution.price} · Fees ${formatMoney(execution.fees, currency)}`,
        notes: execution.notes || "",
        rank: 10,
        sourceIndex: index,
      });
    });
  } else {
    add({
      id: "summary-entry",
      kind: "execution",
      at: trade.entryAt,
      title: "Trade entry",
      detail: [`Price ${trade.entryPrice || "—"}`, trade.positionSize ? `Quantity ${trade.positionSize}` : ""].filter(Boolean).join(" · "),
      notes: "Summary record; no individual fills were supplied.",
      rank: 10,
      sourceIndex: 0,
    });
    if (trade.exitAt) {
      add({
        id: "summary-exit",
        kind: "execution",
        at: trade.exitAt,
        title: "Trade exit",
        detail: `Price ${trade.exitPrice || "—"}`,
        notes: "Summary record; no individual fills were supplied.",
        rank: 10,
        sourceIndex: 1,
      });
    }
  }

  (trade.pricePath || []).forEach((point, index) => {
    add({
      id: `price-${point.id || normalizedTimestamp(point.observedAt) || index}`,
      kind: "price",
      at: point.observedAt,
      title: "Recorded price",
      detail: `Observed price ${point.price}`,
      notes: point.notes || "",
      rank: 20,
      sourceIndex: index,
    });
  });

  (trade.riskLevels || []).forEach((level, index) => {
    add({
      id: `risk-${level.id || normalizedTimestamp(level.effectiveAt) || index}`,
      kind: "risk",
      at: level.effectiveAt,
      title: "Stop / target snapshot",
      detail: `Stop ${level.stopLoss ?? "none"} · Target ${level.takeProfit ?? "none"}`,
      notes: level.notes || "",
      rank: 30,
      sourceIndex: index,
    });
  });

  (trade.screenshots || []).forEach((screenshot, index) => {
    add({
      id: `screenshot-${screenshot.id}`,
      kind: "screenshot",
      at: screenshot.createdAt,
      title: screenshotLabel(screenshot.category),
      detail: "Chart image · shown at upload time",
      notes: screenshot.caption || "",
      rank: 40,
      sourceIndex: index,
      screenshot: {
        id: screenshot.id,
        category: screenshot.category,
        caption: screenshot.caption,
      },
    });
  });

  return events.sort((left, right) =>
    Date.parse(left.at) - Date.parse(right.at)
    || left.rank - right.rank
    || left.sourceIndex - right.sourceIndex
    || left.id.localeCompare(right.id));
}
