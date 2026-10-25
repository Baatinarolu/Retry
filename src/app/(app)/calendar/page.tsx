"use client";

import { Filters } from "@/components/Filters";
import { Banner, Button, Card } from "@/components/ui";
import { useWorkspace } from "@/components/useWorkspace";
import { formatMoney, formatR, pnlClass } from "@/lib/format";
import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth, startOfWeek, endOfWeek } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function CalendarPage() {
  const ws = useWorkspace();
  const { loading: workspaceLoading, loadAnalytics } = ws;
  const [cursor, setCursor] = useState(new Date());
  const [daily, setDaily] = useState<{ date: string; pnl: number; trades: number; winRate: number; r: number }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dayTrades, setDayTrades] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [colorBlind, setColorBlind] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (workspaceLoading) return;
    const controller = new AbortController();
    loadAnalytics(controller.signal)
      .then((result) => {
        setDaily(result.analytics?.daily || []);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Could not load calendar");
        }
      });
    return () => controller.abort();
  }, [workspaceLoading, loadAnalytics]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const map = useMemo(() => new Map(daily.map((d) => [d.date, d])), [daily]);
  const maxAbs = Math.max(1, ...daily.map((d) => Math.abs(d.pnl)));

  async function openDay(iso: string) {
    setSelected(iso);
    setError("");
    try {
      const params = new URLSearchParams(ws.qs);
      params.set("from", iso);
      params.set("to", iso);
      params.set("dateField", "exit");
      params.set("limit", "100");
      const [tradeResponse, journalResponse] = await Promise.all([
        fetch(`/api/trades?${params}`),
        fetch(`/api/journal?date=${iso}`),
      ]);
      const trades = await tradeResponse.json();
      const journal = await journalResponse.json();
      if (!tradeResponse.ok || !journalResponse.ok) throw new Error(trades.error || journal.error || "Could not open day");
      setDayTrades(trades.trades || []);
      setNote(journal.entry?.notes || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open day");
    }
  }

  async function saveNote() {
    if (!selected) return;
    const response = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journalDate: selected, notes: note }),
    });
    if (!response.ok) setError("Could not save this journal note.");
  }

  return (
    <div className="space-y-5">
      {ws.error || error ? <Banner tone="warn">{ws.error || error}</Banner> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-[var(--muted)]">Realized net P&L by exit date. Day details use the same filters as the heat map.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={colorBlind} onChange={(e) => setColorBlind(e.target.checked)} />
          Color-blind palette
        </label>
      </div>
      <Card>
        <Filters value={ws.filters} onChange={ws.setFilters} accounts={ws.accounts} instruments={ws.instruments} strategies={ws.strategies} />
      </Card>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setCursor((d) => addMonths(d, -1))}>Prev</Button>
          <h2 className="font-semibold">{format(cursor, "MMMM yyyy")}</h2>
          <Button variant="ghost" onClick={() => setCursor((d) => addMonths(d, 1))}>Next</Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted)]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const rec = map.get(iso);
            const intensity = rec ? Math.min(1, Math.abs(rec.pnl) / maxAbs) : 0;
            const pos = (rec?.pnl || 0) >= 0;
            const bg = !rec
              ? "var(--bg-card-2)"
              : colorBlind
                ? pos
                  ? `rgba(56,189,248,${0.15 + intensity * 0.55})`
                  : `rgba(251,191,36,${0.15 + intensity * 0.55})`
                : pos
                  ? `rgba(52,211,153,${0.12 + intensity * 0.55})`
                  : `rgba(248,113,113,${0.12 + intensity * 0.55})`;
            const outside = d.getMonth() !== cursor.getMonth();
            return (
              <button
                key={iso}
                onClick={() => openDay(iso)}
                className="min-h-20 rounded-xl p-2 text-left"
                style={{ background: bg, opacity: outside ? 0.45 : 1 }}
                aria-label={`${iso} ${rec ? rec.pnl : "no trades"}`}
              >
                <p className="text-xs">{d.getDate()}</p>
                {rec ? (
                  <>
                    <p className={`font-mono-num text-xs ${pnlClass(rec.pnl)}`}>{rec.pnl.toFixed(0)}</p>
                    <p className="text-[10px] text-[var(--muted)]">{rec.trades}t · {(rec.winRate * 100).toFixed(0)}%</p>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>
      {selected ? (
        <Card>
          <h2 className="font-semibold">{selected}</h2>
          {dayTrades.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">No trades this day.</p> : null}
          <ul className="mt-3 space-y-2">
            {dayTrades.map((t) => (
              <li key={t.id}>
                <Link href={`/trades/${t.id}`} className="flex justify-between text-sm">
                  <span>{t.instrument} {t.direction}</span>
                  <span className={pnlClass(t.netPnl)}>{formatMoney(t.netPnl, ws.currency)} · {formatR(t.rMultiple)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <textarea className="textarea mt-4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Daily notes" />
          <Button className="mt-3" onClick={saveNote}>Save note</Button>
        </Card>
      ) : (
        <Banner>Select a day to inspect trades and write a journal note.</Banner>
      )}
    </div>
  );
}
