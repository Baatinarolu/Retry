import { db } from "@/db";
import {
  dailyJournals,
  psychologyRecords,
  strategies,
  tags,
  tradeTags,
  trades,
  tradingAccounts,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { computeTradeMetrics } from "./calculations";

type DemoSpec = {
  dayOffset: number;
  hour: number;
  hold: number;
  instrument: string;
  category: string;
  direction: "long" | "short";
  type: string;
  session: string;
  entry: string;
  exit: string;
  sl: string;
  tp: string;
  lots: string;
  pipSize: string;
  pipValue: string;
  tickSize: string;
  tickValue: string;
  commission: string;
  strategy: string;
  tags: string[];
  followed: boolean;
  news: boolean;
  notes: string;
  psych: {
    before: string;
    during: string;
    after: string;
    confidence: number;
    patience: number;
    fomo?: boolean;
    revenge?: boolean;
    early?: boolean;
    moved?: boolean;
    broke?: boolean;
    impulsive?: boolean;
    greedy?: boolean;
    lessons: string;
    well: string;
    improve: string;
  };
};

const SPECS: DemoSpec[] = [
  {
    dayOffset: 55, hour: 8, hold: 45, instrument: "EURUSD", category: "forex", direction: "long", type: "intraday", session: "london",
    entry: "1.08200", exit: "1.08520", sl: "1.08040", tp: "1.08680", lots: "0.8", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "6",
    strategy: "ICT Silver Bullet", tags: ["Fair Value Gap (FVG)", "Kill Zone", "Daily Bias"], followed: true, news: false,
    notes: "London open FVG after SSL sweep. Held to 2R.",
    psych: { before: "Focused", during: "Calm", after: "Disciplined", confidence: 7, patience: 8, lessons: "Waited for displacement.", well: "Did not chase the sweep.", improve: "Could have scaled partial at 1.5R." },
  },
  {
    dayOffset: 54, hour: 13, hold: 70, instrument: "XAUUSD", category: "metals", direction: "short", type: "intraday", session: "overlap_london_ny",
    entry: "2348.50", exit: "2336.20", sl: "2356.40", tp: "2328.00", lots: "0.4", pipSize: "0.1", pipValue: "10", tickSize: "0", tickValue: "0", commission: "8",
    strategy: "Liquidity Sweep Reversal", tags: ["Liquidity Sweep", "Judas Swing", "CHoCH"], followed: true, news: false,
    notes: "Judas swing above PDH then CHoCH.",
    psych: { before: "Confident", during: "Focused", after: "Calm", confidence: 8, patience: 7, lessons: "PDH liquidity was the magnet.", well: "Stop beyond the wick.", improve: "" },
  },
  {
    dayOffset: 53, hour: 9, hold: 25, instrument: "US30", category: "indices", direction: "long", type: "scalp", session: "london",
    entry: "39120", exit: "39040", sl: "39080", tp: "39210", lots: "1", pipSize: "1", pipValue: "1", tickSize: "1", tickValue: "1", commission: "2",
    strategy: "SMC Order Block Continuation", tags: ["Order Block", "BOS"], followed: false, news: false,
    notes: "Entered before BOS confirmation.",
    psych: { before: "FOMO", during: "Anxious", after: "Frustrated", confidence: 4, patience: 3, fomo: true, impulsive: true, lessons: "No BOS, no trade.", well: "Cut loss.", improve: "Wait for displacement." },
  },
  {
    dayOffset: 52, hour: 14, hold: 110, instrument: "GBPUSD", category: "forex", direction: "short", type: "intraday", session: "newyork",
    entry: "1.26840", exit: "1.26410", sl: "1.27100", tp: "1.26200", lots: "0.6", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "5",
    strategy: "ICT Silver Bullet", tags: ["SSL", "FVG", "OTE"], followed: true, news: false,
    notes: "NY kill zone OTE short after SSL.",
    psych: { before: "Calm", during: "Patient", after: "Confident", confidence: 7, patience: 8, lessons: "OTE from 4h discount.", well: "Let it run.", improve: "" },
  },
  {
    dayOffset: 50, hour: 7, hold: 40, instrument: "EURUSD", category: "forex", direction: "short", type: "scalp", session: "asian",
    entry: "1.08410", exit: "1.08580", sl: "1.08550", tp: "1.08180", lots: "0.5", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "4",
    strategy: "Liquidity Sweep Reversal", tags: ["Asian Range"], followed: false, news: false,
    notes: "Faded Asian range without HTF alignment.",
    psych: { before: "Bored", during: "Impulsive", after: "Frustrated", confidence: 3, patience: 2, impulsive: true, broke: true, lessons: "No A+ in Asia for this playbook.", well: "", improve: "Stand aside in dead sessions." },
  },
  {
    dayOffset: 48, hour: 15, hold: 80, instrument: "NAS100", category: "indices", direction: "long", type: "intraday", session: "newyork",
    entry: "17840", exit: "17955", sl: "17790", tp: "18010", lots: "1", pipSize: "1", pipValue: "1", tickSize: "0.25", tickValue: "0.25", commission: "2",
    strategy: "SMC Order Block Continuation", tags: ["Order Block", "Displacement", "HTF Alignment"], followed: true, news: false,
    notes: "NY continuation from 1h OB.",
    psych: { before: "Focused", during: "Calm", after: "Disciplined", confidence: 8, patience: 7, lessons: "HTF alignment first.", well: "Size was 0.4% risk.", improve: "" },
  },
  {
    dayOffset: 47, hour: 13, hold: 20, instrument: "XAUUSD", category: "metals", direction: "long", type: "scalp", session: "overlap_london_ny",
    entry: "2352.10", exit: "2347.40", sl: "2346.80", tp: "2362.00", lots: "0.3", pipSize: "0.1", pipValue: "10", tickSize: "0", tickValue: "0", commission: "6",
    strategy: "ICT Silver Bullet", tags: ["FVG", "Premium"], followed: false, news: true,
    notes: "Entered into NFP spread. Stop hit.",
    psych: { before: "Greedy", during: "Fearful", after: "Frustrated", confidence: 4, patience: 3, fomo: true, broke: true, lessons: "No news trades without a plan.", well: "", improve: "Flat into red-folder news." },
  },
  {
    dayOffset: 45, hour: 9, hold: 95, instrument: "EURUSD", category: "forex", direction: "long", type: "intraday", session: "london",
    entry: "1.07980", exit: "1.08310", sl: "1.07820", tp: "1.08440", lots: "0.7", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "5",
    strategy: "ICT Silver Bullet", tags: ["BOS", "FVG", "Kill Zone"], followed: true, news: false,
    notes: "London displacement FVG.",
    psych: { before: "Calm", during: "Patient", after: "Focused", confidence: 7, patience: 8, lessons: "Partial at PDH would be nicer.", well: "Plan followed.", improve: "Scale-out rule." },
  },
  {
    dayOffset: 43, hour: 16, hold: 50, instrument: "BTCUSD", category: "crypto", direction: "short", type: "intraday", session: "newyork",
    entry: "64250", exit: "63810", sl: "64680", tp: "63200", lots: "0.2", pipSize: "1", pipValue: "1", tickSize: "0.1", tickValue: "0.1", commission: "3",
    strategy: "Liquidity Sweep Reversal", tags: ["Equal Highs / Equal Lows", "Liquidity Sweep"], followed: true, news: false,
    notes: "EqH raid then dump.",
    psych: { before: "Confident", during: "Focused", after: "Calm", confidence: 6, patience: 6, lessons: "Crypto still needs invalidation.", well: "Risk in USD terms defined.", improve: "" },
  },
  {
    dayOffset: 42, hour: 8, hold: 15, instrument: "GBPUSD", category: "forex", direction: "long", type: "scalp", session: "london",
    entry: "1.26120", exit: "1.26120", sl: "1.25980", tp: "1.26400", lots: "0.5", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "4",
    strategy: "SMC Order Block Continuation", tags: ["Order Block"], followed: true, news: false,
    notes: "Scratched at entry after thesis stalled.",
    psych: { before: "Neutral", during: "Hesitant", after: "Calm", confidence: 5, patience: 6, early: true, lessons: "Scratching is allowed.", well: "Did not hope.", improve: "Tighter entry model." },
  },
  {
    dayOffset: 40, hour: 14, hold: 130, instrument: "US30", category: "indices", direction: "short", type: "intraday", session: "newyork",
    entry: "39280", exit: "39110", sl: "39360", tp: "39020", lots: "1", pipSize: "1", pipValue: "1", tickSize: "1", tickValue: "1", commission: "2",
    strategy: "Liquidity Sweep Reversal", tags: ["SSL", "MSS", "Kill Zone"], followed: true, news: false,
    notes: "NY AM raid of Asia high then dump.",
    psych: { before: "Focused", during: "Calm", after: "Disciplined", confidence: 8, patience: 7, lessons: "Indices respect session liquidity.", well: "Waited for MSS.", improve: "" },
  },
  {
    dayOffset: 38, hour: 10, hold: 35, instrument: "XAUUSD", category: "metals", direction: "short", type: "intraday", session: "london",
    entry: "2361.40", exit: "2368.90", sl: "2367.20", tp: "2348.00", lots: "0.35", pipSize: "0.1", pipValue: "10", tickSize: "0", tickValue: "0", commission: "7",
    strategy: "ICT Silver Bullet", tags: ["Premium", "FVG"], followed: false, news: false,
    notes: "Shorted mid-range. Stop hunted.",
    psych: { before: "FOMO", during: "Fearful", after: "Revenge", confidence: 3, patience: 2, fomo: true, revenge: true, lessons: "Mid-range is not a model.", well: "", improve: "Only premium shorts / discount longs." },
  },
  {
    dayOffset: 37, hour: 15, hold: 60, instrument: "EURUSD", category: "forex", direction: "short", type: "intraday", session: "newyork",
    entry: "1.08660", exit: "1.08390", sl: "1.08810", tp: "1.08220", lots: "0.8", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "6",
    strategy: "ICT Silver Bullet", tags: ["IFVG", "Displacement"], followed: true, news: false,
    notes: "IFVG after bearish displacement.",
    psych: { before: "Calm", during: "Patient", after: "Focused", confidence: 7, patience: 8, lessons: "IFVG is continuation not reversal.", well: "Journal screenshot before entry.", improve: "" },
  },
  {
    dayOffset: 35, hour: 9, hold: 200, instrument: "GBPUSD", category: "forex", direction: "long", type: "swing", session: "london",
    entry: "1.25500", exit: "1.26240", sl: "1.25120", tp: "1.26480", lots: "0.4", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "5",
    strategy: "SMC Order Block Continuation", tags: ["Order Block", "HTF Alignment", "Daily Bias"], followed: true, news: false,
    notes: "Daily discount OB.",
    psych: { before: "Patient", during: "Calm", after: "Confident", confidence: 8, patience: 9, lessons: "Swing needs smaller size.", well: "Held overnight with swap accepted.", improve: "" },
  },
  {
    dayOffset: 33, hour: 12, hold: 40, instrument: "NAS100", category: "indices", direction: "short", type: "scalp", session: "overlap_london_ny",
    entry: "18020", exit: "17970", sl: "18055", tp: "17920", lots: "1", pipSize: "1", pipValue: "1", tickSize: "0.25", tickValue: "0.25", commission: "2",
    strategy: "Liquidity Sweep Reversal", tags: ["Breaker Block"], followed: true, news: false,
    notes: "Breaker short.",
    psych: { before: "Focused", during: "Calm", after: "Neutral", confidence: 6, patience: 6, lessons: "Partial too early.", well: "Rules followed.", improve: "Hold runners.", early: true },
  },
  {
    dayOffset: 31, hour: 8, hold: 55, instrument: "USDJPY", category: "forex", direction: "long", type: "intraday", session: "london",
    entry: "148.20", exit: "148.62", sl: "147.95", tp: "148.80", lots: "0.6", pipSize: "0.01", pipValue: "9.1", tickSize: "0", tickValue: "0", commission: "5",
    strategy: "ICT Silver Bullet", tags: ["PO3", "FVG"], followed: true, news: false,
    notes: "PO3 accumulation then expansion.",
    psych: { before: "Calm", during: "Focused", after: "Disciplined", confidence: 7, patience: 7, lessons: "PO3 needs HTF narrative.", well: "Did not move stop.", improve: "" },
  },
  {
    dayOffset: 28, hour: 14, hold: 18, instrument: "US30", category: "indices", direction: "long", type: "scalp", session: "newyork",
    entry: "39410", exit: "39355", sl: "39370", tp: "39500", lots: "2", pipSize: "1", pipValue: "1", tickSize: "1", tickValue: "1", commission: "3",
    strategy: "ICT Silver Bullet", tags: ["Kill Zone"], followed: false, news: false,
    notes: "Doubled size after prior win. Process fail even though it could have worked.",
    psych: { before: "Euphoric", during: "Anxious", after: "Frustrated", confidence: 5, patience: 2, greedy: true, broke: true, lessons: "Never increase size after a win impulsively.", well: "", improve: "Fixed fractional risk only." },
  },
  {
    dayOffset: 26, hour: 9, hold: 75, instrument: "XAUUSD", category: "metals", direction: "long", type: "intraday", session: "london",
    entry: "2328.60", exit: "2341.10", sl: "2321.40", tp: "2346.00", lots: "0.4", pipSize: "0.1", pipValue: "10", tickSize: "0", tickValue: "0", commission: "8",
    strategy: "SMC Order Block Continuation", tags: ["Discount", "Order Block", "BOS"], followed: true, news: false,
    notes: "Discount OB after daily BOS.",
    psych: { before: "Patient", during: "Calm", after: "Focused", confidence: 8, patience: 8, lessons: "Gold in discount with BOS is A.", well: "Let 2R work.", improve: "" },
  },
  {
    dayOffset: 24, hour: 15, hold: 90, instrument: "EURUSD", category: "forex", direction: "short", type: "intraday", session: "newyork",
    entry: "1.09020", exit: "1.08740", sl: "1.09180", tp: "1.08550", lots: "0.7", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "5",
    strategy: "ICT Silver Bullet", tags: ["SMT Divergence", "FVG"], followed: true, news: false,
    notes: "SMT vs GBP then NY continuation.",
    psych: { before: "Focused", during: "Calm", after: "Confident", confidence: 7, patience: 7, lessons: "SMT is confluence not trigger.", well: "Waited for FVG.", improve: "" },
  },
  {
    dayOffset: 22, hour: 7, hold: 30, instrument: "GBPUSD", category: "forex", direction: "short", type: "scalp", session: "asian",
    entry: "1.27010", exit: "1.27180", sl: "1.27140", tp: "1.26750", lots: "0.4", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "4",
    strategy: "Liquidity Sweep Reversal", tags: ["Asian Range"], followed: false, news: false,
    notes: "Low quality Asia fade.",
    psych: { before: "Tired", during: "Impulsive", after: "Frustrated", confidence: 3, patience: 2, impulsive: true, lessons: "Sleep > Asia scalp.", well: "", improve: "Session filter." },
  },
  {
    dayOffset: 20, hour: 13, hold: 100, instrument: "NAS100", category: "indices", direction: "long", type: "intraday", session: "overlap_london_ny",
    entry: "17710", exit: "17840", sl: "17650", tp: "17890", lots: "1", pipSize: "1", pipValue: "1", tickSize: "0.25", tickValue: "0.25", commission: "2",
    strategy: "SMC Order Block Continuation", tags: ["Displacement", "OB"], followed: true, news: false,
    notes: "Open drive continuation.",
    psych: { before: "Calm", during: "Focused", after: "Disciplined", confidence: 7, patience: 7, lessons: "Don't fade strong opens.", well: "Traded with displacement.", improve: "" },
  },
  {
    dayOffset: 18, hour: 10, hold: 48, instrument: "XAUUSD", category: "metals", direction: "short", type: "intraday", session: "london",
    entry: "2374.20", exit: "2365.50", sl: "2381.00", tp: "2358.00", lots: "0.3", pipSize: "0.1", pipValue: "10", tickSize: "0", tickValue: "0", commission: "6",
    strategy: "ICT Silver Bullet", tags: ["Premium", "OTE", "Kill Zone"], followed: true, news: false,
    notes: "OTE short in premium.",
    psych: { before: "Focused", during: "Patient", after: "Calm", confidence: 8, patience: 8, lessons: "Premium/discount filter works.", well: "No tinkering.", improve: "" },
  },
  {
    dayOffset: 16, hour: 14, hold: 22, instrument: "US30", category: "indices", direction: "short", type: "scalp", session: "newyork",
    entry: "39550", exit: "39550", sl: "39600", tp: "39440", lots: "1", pipSize: "1", pipValue: "1", tickSize: "1", tickValue: "1", commission: "2",
    strategy: "Liquidity Sweep Reversal", tags: ["Equal Highs / Equal Lows"], followed: true, news: true,
    notes: "Scratched into FOMC wait.",
    psych: { before: "Anxious", during: "Fearful", after: "Neutral", confidence: 4, patience: 5, lessons: "Event risk is a flat decision.", well: "Did not gamble the number.", improve: "" },
  },
  {
    dayOffset: 14, hour: 8, hold: 65, instrument: "EURUSD", category: "forex", direction: "long", type: "intraday", session: "london",
    entry: "1.07440", exit: "1.07790", sl: "1.07280", tp: "1.07920", lots: "0.9", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "6",
    strategy: "ICT Silver Bullet", tags: ["FVG", "BSL", "Kill Zone"], followed: true, news: false,
    notes: "Buy-side as target after discount FVG.",
    psych: { before: "Calm", during: "Disciplined", after: "Confident", confidence: 8, patience: 8, lessons: "Draw liquidity first.", well: "Process A+.", improve: "" },
  },
  {
    dayOffset: 12, hour: 16, hold: 40, instrument: "BTCUSD", category: "crypto", direction: "long", type: "intraday", session: "newyork",
    entry: "61840", exit: "61120", sl: "61200", tp: "63200", lots: "0.15", pipSize: "1", pipValue: "1", tickSize: "0.1", tickValue: "0.1", commission: "3",
    strategy: "SMC Order Block Continuation", tags: ["Order Block"], followed: false, news: false,
    notes: "Widened stop then still lost.",
    psych: { before: "Hopeful", during: "Fearful", after: "Frustrated", confidence: 4, patience: 3, moved: true, broke: true, lessons: "Stop is invalidation, not a suggestion.", well: "", improve: "Hard stop, no drag." },
  },
  {
    dayOffset: 10, hour: 9, hold: 85, instrument: "GBPUSD", category: "forex", direction: "short", type: "intraday", session: "london",
    entry: "1.27330", exit: "1.26910", sl: "1.27560", tp: "1.26700", lots: "0.55", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "5",
    strategy: "Liquidity Sweep Reversal", tags: ["Judas Swing", "CHoCH"], followed: true, news: false,
    notes: "London Judas then CHoCH.",
    psych: { before: "Patient", during: "Calm", after: "Focused", confidence: 7, patience: 8, lessons: "Let the raid complete.", well: "No prediction of the wick.", improve: "" },
  },
  {
    dayOffset: 8, hour: 15, hold: 55, instrument: "XAUUSD", category: "metals", direction: "long", type: "intraday", session: "newyork",
    entry: "2315.80", exit: "2328.40", sl: "2308.50", tp: "2334.00", lots: "0.4", pipSize: "0.1", pipValue: "10", tickSize: "0", tickValue: "0", commission: "7",
    strategy: "ICT Silver Bullet", tags: ["Discount", "FVG", "Daily Bias"], followed: true, news: false,
    notes: "NY continuation with daily bullish bias.",
    psych: { before: "Focused", during: "Calm", after: "Disciplined", confidence: 8, patience: 7, lessons: "Bias first.", well: "Risk 0.45%.", improve: "" },
  },
  {
    dayOffset: 6, hour: 11, hold: 28, instrument: "US30", category: "indices", direction: "long", type: "scalp", session: "london",
    entry: "39680", exit: "39620", sl: "39630", tp: "39780", lots: "1", pipSize: "1", pipValue: "1", tickSize: "1", tickValue: "1", commission: "2",
    strategy: "SMC Order Block Continuation", tags: ["Order Block"], followed: true, news: false,
    notes: "Tight OB failed.",
    psych: { before: "Neutral", during: "Calm", after: "Neutral", confidence: 6, patience: 6, lessons: "Loss is a business cost.", well: "No revenge.", improve: "" },
  },
  {
    dayOffset: 4, hour: 13, hold: 70, instrument: "EURUSD", category: "forex", direction: "short", type: "intraday", session: "overlap_london_ny",
    entry: "1.08880", exit: "1.08560", sl: "1.09040", tp: "1.08380", lots: "0.75", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", commission: "5",
    strategy: "ICT Silver Bullet", tags: ["IFVG", "SSL"], followed: true, news: false,
    notes: "Overlap IFVG.",
    psych: { before: "Calm", during: "Focused", after: "Confident", confidence: 7, patience: 7, lessons: "Overlap volume helps.", well: "Checklist complete.", improve: "" },
  },
  {
    dayOffset: 2, hour: 9, hold: 50, instrument: "NAS100", category: "indices", direction: "short", type: "intraday", session: "london",
    entry: "18110", exit: "18035", sl: "18155", tp: "17980", lots: "1", pipSize: "1", pipValue: "1", tickSize: "0.25", tickValue: "0.25", commission: "2",
    strategy: "Liquidity Sweep Reversal", tags: ["Liquidity Sweep", "MSS"], followed: true, news: false,
    notes: "Sweep of previous day high.",
    psych: { before: "Focused", during: "Patient", after: "Calm", confidence: 7, patience: 8, lessons: "PDH still relevant.", well: "Journaled before fill.", improve: "" },
  },
  {
    dayOffset: 1, hour: 14, hold: 35, instrument: "XAUUSD", category: "metals", direction: "short", type: "scalp", session: "newyork",
    entry: "2388.10", exit: "2382.40", sl: "2393.20", tp: "2376.00", lots: "0.25", pipSize: "0.1", pipValue: "10", tickSize: "0", tickValue: "0", commission: "5",
    strategy: "ICT Silver Bullet", tags: ["Kill Zone", "FVG"], followed: true, news: false,
    notes: "Compact NY short.",
    psych: { before: "Calm", during: "Focused", after: "Disciplined", confidence: 6, patience: 7, lessons: "Smaller gold size during chop.", well: "Followed plan.", improve: "" },
  },
];

export async function seedDemoTrades(userId: string) {
  const existing = await db.select({ id: trades.id }).from(trades).where(eq(trades.userId, userId)).limit(1);
  if (existing.length) return;

  const [account] = await db.select().from(tradingAccounts).where(eq(tradingAccounts.userId, userId)).limit(1);
  const stratRows = await db.select().from(strategies).where(eq(strategies.userId, userId));
  const tagRows = await db.select().from(tags).where(eq(tags.userId, userId));
  const stratMap = new Map(stratRows.map((s) => [s.name, s.id]));
  const tagMap = new Map(tagRows.map((t) => [t.name, t.id]));

  let balance = Number(account.currentBalance);
  const now = new Date();
  let seq = 1;

  for (const spec of SPECS) {
    const entryAt = new Date(now);
    entryAt.setUTCDate(entryAt.getUTCDate() - spec.dayOffset);
    entryAt.setUTCHours(spec.hour, 12, 0, 0);
    const exitAt = new Date(entryAt.getTime() + spec.hold * 60000);
    const metrics = computeTradeMetrics({
      direction: spec.direction,
      entryPrice: spec.entry,
      exitPrice: spec.exit,
      stopLoss: spec.sl,
      takeProfit: spec.tp,
      lotSize: spec.lots,
      positionSize: spec.lots,
      pipSize: spec.pipSize,
      pipValue: spec.pipValue,
      tickSize: spec.tickSize,
      tickValue: spec.tickValue,
      contractSize: "0",
      commission: spec.commission,
      swap: "0",
      slippage: "0",
      entryAt,
      exitAt,
    });
    const before = balance;
    balance = Number((balance + Number(metrics.netPnl)).toFixed(2));
    const displayId = `TM-DEMO-${String(seq).padStart(3, "0")}`;
    seq += 1;
    const [trade] = await db
      .insert(trades)
      .values({
        userId,
        accountId: account.id,
        strategyId: stratMap.get(spec.strategy) ?? null,
        displayId,
        instrument: spec.instrument,
        marketCategory: spec.category,
        direction: spec.direction,
        tradeType: spec.type,
        session: spec.session,
        timezone: "UTC",
        entryAt,
        exitAt,
        entryPrice: spec.entry,
        exitPrice: spec.exit,
        stopLoss: spec.sl,
        takeProfit: spec.tp,
        positionSize: spec.lots,
        lotSize: spec.lots,
        pipSize: spec.pipSize,
        pipValue: spec.pipValue,
        tickSize: spec.tickSize,
        tickValue: spec.tickValue,
        commission: spec.commission,
        grossPnl: metrics.grossPnl,
        netPnl: metrics.netPnl,
        initialRisk: metrics.initialRisk,
        plannedRr: metrics.plannedRr,
        actualRr: metrics.actualRr,
        rMultiple: metrics.rMultiple,
        balanceBefore: before.toFixed(2),
        balanceAfter: balance.toFixed(2),
        status: "closed",
        result: metrics.result,
        entryTimeframe: "15m",
        htfTimeframe: "4h",
        followedPlan: spec.followed,
        newsRelated: spec.news,
        notes: spec.notes,
        holdingMinutes: metrics.holdingMinutes,
        marketBias: spec.direction === "long" ? "Bullish" : "Bearish",
        htfDirection: spec.direction === "long" ? "Bullish" : "Bearish",
      })
      .returning();

    await db.insert(psychologyRecords).values({
      tradeId: trade.id,
      userId,
      emotionBefore: spec.psych.before,
      emotionDuring: spec.psych.during,
      emotionAfter: spec.psych.after,
      confidence: spec.psych.confidence,
      patience: spec.psych.patience,
      fomo: Boolean(spec.psych.fomo),
      revenge: Boolean(spec.psych.revenge),
      earlyExit: Boolean(spec.psych.early),
      movedStop: Boolean(spec.psych.moved),
      brokeRiskRules: Boolean(spec.psych.broke),
      impulsive: Boolean(spec.psych.impulsive),
      greed: Boolean(spec.psych.greedy),
      followedPlan: spec.followed,
      lessons: spec.psych.lessons,
      didWell: spec.psych.well,
      improve: spec.psych.improve,
      reflection: spec.notes,
    });

    const ids = spec.tags.map((n) => tagMap.get(n)).filter((id): id is string => Boolean(id));
    if (ids.length) {
      await db.insert(tradeTags).values(ids.map((tagId) => ({ tradeId: trade.id, tagId })));
    }
  }

  await db
    .update(tradingAccounts)
    .set({ currentBalance: balance.toFixed(2) })
    .where(eq(tradingAccounts.id, account.id));

  await db.insert(dailyJournals).values([
    {
      userId,
      accountId: account.id,
      journalDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      notes: "Followed the London playbook. One A+ EURUSD. Stopped after the plan, no extra size.",
      mood: "Disciplined",
      mistakes: "None material.",
      grade: "A",
      followedRules: true,
    },
    {
      userId,
      accountId: account.id,
      journalDate: new Date(Date.now() - 86400000 * 12).toISOString().slice(0, 10),
      notes: "Moved a BTC stop. Process fail. Reviewing the rule: invalidation is the stop.",
      mood: "Frustrated",
      mistakes: "Moved stop, hoped instead of executed.",
      grade: "D",
      followedRules: false,
    },
  ]);
}
