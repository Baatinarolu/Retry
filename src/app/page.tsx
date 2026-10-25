import { DemoButton } from "@/components/DemoButton";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

const features = [
  ["Trade journal", "Record longs, shorts, partials, fees, and contract specs without assuming every market is a forex lot."],
  ["Visual review", "Attach pre-trade, entry, and exit charts privately — only you can open them."],
  ["Analytics that reconcile", "Win rate, expectancy in R, profit factor, and drawdown are computed from stored trades."],
  ["Psychology", "Tag FOMO, revenge, early exits, and plan breaks. Treat findings as correlations."],
  ["Strategy Lab", "Version playbooks and score them against live journal history."],
  ["AI Coach, optional", "Rule-based reviews always work. External models require your permission and never invent trades."],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" />
          <div>
            <p className="font-semibold">{APP_NAME}</p>
            <p className="text-xs text-[var(--muted)]">Trading journal</p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Create account
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-8 lg:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-teal-300">Process over prediction</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">{APP_NAME}</h1>
          <p className="mt-4 max-w-xl text-lg text-[var(--muted)]">
            {APP_TAGLINE} Built for forex, indices, gold, futures, and crypto traders — including desks that think in NGN as well as USD.
          </p>
          <p className="mt-3 max-w-xl text-sm text-[var(--muted)]">
            No profit promises. No live buy/sell signals. Your edge is measured in R, rule-following, and sample size.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn btn-primary">
              Start journaling
            </Link>
            <DemoButton />
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-[var(--border)] shadow-[var(--shadow)]">
          <Image
            src="/hero-desk.jpg"
            alt="Trading desk with charts and a journal"
            width={1200}
            height={700}
            priority
            className="h-[22rem] w-full object-cover"
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-2 lg:grid-cols-3">
        {features.map(([title, body]) => (
          <article key={title} className="card-quiet p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
