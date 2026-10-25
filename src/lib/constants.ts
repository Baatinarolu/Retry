export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "TradeMind Journal";
export const APP_TAGLINE = "Professional trading performance, psychology, and process.";

export const SESSION_COOKIE = "tm_session";

export const MARKET_CATEGORIES = [
  { value: "forex", label: "Forex" },
  { value: "indices", label: "Indices" },
  { value: "metals", label: "Metals / Gold" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "futures", label: "Futures" },
  { value: "stocks", label: "Stocks" },
  { value: "other", label: "Other" },
] as const;

export const DIRECTIONS = [
  { value: "long", label: "Buy / Long" },
  { value: "short", label: "Sell / Short" },
] as const;

export const TRADE_TYPES = [
  { value: "scalp", label: "Scalp" },
  { value: "intraday", label: "Intraday" },
  { value: "day", label: "Day trade" },
  { value: "swing", label: "Swing" },
] as const;

export const SESSIONS = [
  { value: "asian", label: "Asian" },
  { value: "london", label: "London" },
  { value: "newyork", label: "New York" },
  { value: "overlap_london_ny", label: "London / NY overlap" },
  { value: "overlap_asia_london", label: "Asia / London overlap" },
  { value: "other", label: "Other" },
] as const;

export const TIMEFRAMES = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "D",
  "W",
  "M",
] as const;

export const EMOTIONS = [
  "Calm",
  "Focused",
  "Confident",
  "Anxious",
  "Fearful",
  "FOMO",
  "Greedy",
  "Frustrated",
  "Revenge",
  "Bored",
  "Euphoric",
  "Tired",
  "Neutral",
  "Disciplined",
] as const;

export const SCREENSHOT_CATEGORIES = [
  { value: "pretrade", label: "Pre-trade chart" },
  { value: "entry", label: "Entry chart" },
  { value: "exit", label: "Exit chart" },
  { value: "htf", label: "Higher-timeframe" },
  { value: "ltf", label: "Lower-timeframe execution" },
  { value: "annotated", label: "Annotated" },
  { value: "other", label: "Supporting" },
] as const;

export const ICT_SMC_TAGS: { name: string; category: string; color: string }[] = [
  { name: "Break of Structure (BOS)", category: "smc", color: "#38bdf8" },
  { name: "Change of Character (CHoCH)", category: "smc", color: "#818cf8" },
  { name: "Market Structure Shift (MSS)", category: "smc", color: "#a78bfa" },
  { name: "Fair Value Gap (FVG)", category: "ict", color: "#2dd4bf" },
  { name: "Inverse Fair Value Gap (IFVG)", category: "ict", color: "#14b8a6" },
  { name: "Order Block", category: "smc", color: "#fbbf24" },
  { name: "Breaker Block", category: "smc", color: "#fb923c" },
  { name: "Mitigation Block", category: "smc", color: "#f59e0b" },
  { name: "Liquidity Sweep", category: "ict", color: "#f87171" },
  { name: "Buy-side Liquidity (BSL)", category: "ict", color: "#34d399" },
  { name: "Sell-side Liquidity (SSL)", category: "ict", color: "#fb7185" },
  { name: "Equal Highs / Equal Lows", category: "ict", color: "#94a3b8" },
  { name: "Premium", category: "ict", color: "#f472b6" },
  { name: "Discount", category: "ict", color: "#22d3ee" },
  { name: "Equilibrium", category: "ict", color: "#c084fc" },
  { name: "Optimal Trade Entry (OTE)", category: "ict", color: "#4ade80" },
  { name: "Displacement", category: "ict", color: "#60a5fa" },
  { name: "Inducement", category: "ict", color: "#e879f9" },
  { name: "Power of Three (PO3)", category: "ict", color: "#facc15" },
  { name: "Previous Day High / Low", category: "ict", color: "#67e8f9" },
  { name: "Previous Week High / Low", category: "ict", color: "#7dd3fc" },
  { name: "Asian Range", category: "ict", color: "#86efac" },
  { name: "Judas Swing", category: "ict", color: "#fda4af" },
  { name: "SMT Divergence", category: "ict", color: "#d8b4fe" },
  { name: "Kill Zone", category: "ict", color: "#fdba74" },
  { name: "Daily Bias", category: "ict", color: "#5eead4" },
  { name: "HTF Alignment", category: "ict", color: "#93c5fd" },
];

export const DEFAULT_INSTRUMENTS = [
  {
    symbol: "EURUSD",
    name: "Euro / US Dollar",
    category: "forex",
    contractSize: "100000",
    tickSize: "0.00001",
    tickValue: "1",
    pipSize: "0.0001",
    pipValue: "10",
    quoteCurrency: "USD",
  },
  {
    symbol: "GBPUSD",
    name: "Pound / US Dollar",
    category: "forex",
    contractSize: "100000",
    tickSize: "0.00001",
    tickValue: "1",
    pipSize: "0.0001",
    pipValue: "10",
    quoteCurrency: "USD",
  },
  {
    symbol: "USDJPY",
    name: "US Dollar / Yen",
    category: "forex",
    contractSize: "100000",
    tickSize: "0.001",
    tickValue: "0.91",
    pipSize: "0.01",
    pipValue: "9.1",
    quoteCurrency: "JPY",
  },
  {
    symbol: "XAUUSD",
    name: "Gold / US Dollar",
    category: "metals",
    contractSize: "100",
    tickSize: "0.01",
    tickValue: "1",
    pipSize: "0.1",
    pipValue: "10",
    quoteCurrency: "USD",
  },
  {
    symbol: "US30",
    name: "Dow Jones 30",
    category: "indices",
    contractSize: "1",
    tickSize: "1",
    tickValue: "1",
    pipSize: "1",
    pipValue: "1",
    quoteCurrency: "USD",
  },
  {
    symbol: "NAS100",
    name: "Nasdaq 100",
    category: "indices",
    contractSize: "1",
    tickSize: "0.25",
    tickValue: "0.25",
    pipSize: "1",
    pipValue: "1",
    quoteCurrency: "USD",
  },
  {
    symbol: "BTCUSD",
    name: "Bitcoin / US Dollar",
    category: "crypto",
    contractSize: "1",
    tickSize: "0.1",
    tickValue: "0.1",
    pipSize: "1",
    pipValue: "1",
    quoteCurrency: "USD",
  },
  {
    symbol: "USDNGN",
    name: "US Dollar / Nigerian Naira",
    category: "forex",
    contractSize: "1000",
    tickSize: "0.01",
    tickValue: "10",
    pipSize: "0.01",
    pipValue: "10",
    quoteCurrency: "NGN",
  },
];

export const DEFAULT_STRATEGIES = [
  {
    name: "ICT Silver Bullet",
    description:
      "Session-based model looking for liquidity sweep and displacement into a fair value gap during the Silver Bullet window.",
    marketConditions: "Clear HTF bias, liquidity resting above/below session highs or lows.",
    confirmations: "HTF bias, liquidity sweep, displacement, FVG in discount/premium.",
    entryRules: "Enter on FVG after displacement following a liquidity raid during the kill zone.",
    stopLossRules: "Beyond the swept liquidity or invalidation swing.",
    takeProfitRules: "Opposing liquidity, session high/low, or 2R+ target.",
    riskRules: "Risk 0.25–0.5% per idea. One A+ setup per session.",
    invalidation: "No displacement, overlapping candles, or mid-range entry.",
    checklist: [
      "Daily bias defined",
      "Session liquidity mapped",
      "Sweep confirmed",
      "Displacement present",
      "FVG in premium/discount",
      "Risk defined before click",
    ],
  },
  {
    name: "SMC Order Block Continuation",
    description: "Trade in the direction of HTF structure from a mitigated order block after a BOS.",
    marketConditions: "Trending market with impulsive legs and clean structure.",
    confirmations: "BOS, order block, displacement, volume imbalance optional.",
    entryRules: "Limit or confirmation entry at the order block after BOS.",
    stopLossRules: "Beyond the order block wick.",
    takeProfitRules: "Next unmitigated liquidity pool.",
    riskRules: "Skip if planned R:R is below 2.",
    invalidation: "Close through the order block with displacement against bias.",
    checklist: ["HTF BOS", "Fresh OB", "Displacement", "R:R ≥ 2"],
  },
  {
    name: "Liquidity Sweep Reversal",
    description: "Fade a Judas swing or stop raid that fails to continue.",
    marketConditions: "Range or session open manipulation.",
    confirmations: "Equal highs/lows, sweep, CHoCH, displacement.",
    entryRules: "After CHoCH, enter on retrace into FVG/OB.",
    stopLossRules: "Beyond the sweep wick.",
    takeProfitRules: "Opposing range liquidity.",
    riskRules: "Do not add if the first idea is stopped.",
    invalidation: "Strong continuation through the sweep with no CHoCH.",
    checklist: ["Equal highs/lows marked", "Sweep", "CHoCH", "Defined invalidation"],
  },
];

export const CURRENCIES = [
  "USD",
  "NGN",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "ZAR",
  "GHS",
  "KES",
] as const;

export const TIMEZONES = [
  "Africa/Lagos",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export const MIN_SAMPLE_FOR_CONCLUSION = 20;
// Multipart overhead still fits below Vercel Functions' 4.5 MB request limit.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/journal", label: "Trade Journal", icon: "BookOpen" },
  { href: "/trades/new", label: "Add Trade", icon: "PlusCircle" },
  { href: "/calendar", label: "Calendar", icon: "CalendarDays" },
  { href: "/analytics", label: "Analytics", icon: "BarChart3" },
  { href: "/strategies", label: "Strategy Lab", icon: "FlaskConical" },
  { href: "/backtesting", label: "Backtesting", icon: "History" },
  { href: "/psychology", label: "Psychology", icon: "Brain" },
  { href: "/ai-coach", label: "AI Coach", icon: "Sparkles" },
  { href: "/reports", label: "Reports", icon: "FileText" },
  { href: "/risk", label: "Risk", icon: "Shield" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;
