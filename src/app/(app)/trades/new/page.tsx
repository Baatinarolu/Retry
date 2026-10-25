import { TradeForm } from "@/components/TradeForm";

export default function NewTradePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Add trade</h1>
        <p className="text-sm text-[var(--muted)]">Calculator uses your instrument spec. Drafts stay local until the server confirms.</p>
      </div>
      <TradeForm />
    </div>
  );
}
