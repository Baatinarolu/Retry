import { DemoButton } from "@/components/DemoButton";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

const features = [
  ["A complete trade record", "Longs, shorts, partial exits, fees, and contract specifications—recorded with the detail your review actually needs."],
  ["Charts in context", "Keep pre-trade, entry, and exit screenshots beside the decision. Private by default, and visible only to you."],
  ["Numbers that reconcile", "Win rate, expectancy in R, profit factor, and drawdown are calculated from the trades in your journal."],
  ["Behavior under review", "Tag hesitation, FOMO, revenge, early exits, and plan breaks. Look for patterns without confusing correlation for cause."],
  ["Playbooks with a history", "Version your strategy rules and compare them with real journal history in Strategy Lab."],
  ["Coaching on your terms", "Free rule-based reviews always work. External models are optional, require permission, and never invent trades."],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="landing-nav">
        <Link href="/" className="brand-lockup" aria-label="TradeMind home">
          <Image src="/logo.png" alt="" width={40} height={40} className="brand-mark h-10 w-10" priority />
          <span>
            <span className="brand-wordmark">{APP_NAME}</span>
            <span className="brand-subtitle">Trading journal</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main navigation">
          <a href="#method" className="mr-3 hidden text-xs text-[var(--muted)] hover:text-[var(--ink)] md:block">The method</a>
          <Link href="/login" className="btn btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn btn-primary">Open your journal</Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="eyebrow">A journal for the deliberate trader</p>
            <h1>Trade less on impulse.<br /><em>Review with intent.</em></h1>
            <p className="lede">{APP_TAGLINE}</p>
            <p className="lede">
              Built for forex, indices, gold, futures, and crypto—including desks that think in NGN as well as USD.
            </p>
            <div className="mt-8 flex flex-wrap items-start gap-3">
              <Link href="/signup" className="btn btn-primary">
                Start your journal <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
              </Link>
              <DemoButton />
            </div>
            <p className="mt-6 max-w-lg border-l border-[var(--line-strong)] pl-4 text-xs leading-5 text-[var(--muted)]">
              No profit promises. No live buy/sell signals. Your edge is measured in R, rule-following, and sample size.
            </p>
          </div>

          <figure className="landing-hero-visual">
            <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <figcaption className="eyebrow">The practice of looking back</figcaption>
              <span className="font-mono text-[10px] text-[var(--faint)]">VOL. 01</span>
            </div>
            <Image
              src="/hero-desk.jpg"
              alt="A paper trading journal, pencil, and market charts arranged on a desk"
              width={1200}
              height={900}
              priority
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="grid grid-cols-3 border-t border-[var(--line)] bg-[var(--surface)] px-2 py-3 text-center">
              <span className="eyebrow">Record</span>
              <span className="eyebrow border-x border-[var(--line)]">Review</span>
              <span className="eyebrow">Refine</span>
            </div>
          </figure>
        </section>

        <section className="landing-proofline" aria-label="Product principles">
          <div><strong>Process over prediction.</strong><span>Document the decision, not just the outcome.</span></div>
          <div><strong>Evidence over instinct.</strong><span>Build conclusions from your own trade history.</span></div>
          <div><strong>Privacy by default.</strong><span>Your journal and chart attachments belong to you.</span></div>
        </section>

        <section id="method" className="landing-features scroll-mt-8">
          <div className="mb-10 grid gap-5 border-b border-[var(--line-strong)] pb-8 md:grid-cols-[1fr_2fr] md:items-end">
            <p className="eyebrow">Inside the journal / 01—06</p>
            <h2 className="max-w-2xl text-3xl leading-tight sm:text-4xl">Everything between the entry and the lesson.</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, body], index) => (
              <article key={title} className="landing-feature">
                <span className="feature-index">{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <p className="eyebrow">Your next review starts here</p>
          <h2>Make the journal part of the trade.</h2>
          <p>Start with one honest entry. Build a record worth learning from.</p>
          <Link href="/signup" className="btn btn-primary mt-6">Create your private journal <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </main>

      <footer className="landing-footer">
        <p>© {new Date().getUTCFullYear()} {APP_NAME}. Built for reflection, not financial advice.</p>
        <a href="https://github.com/Baatinarolu/Retry" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-[var(--ink)]">
          View open-source project <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </footer>
    </div>
  );
}
