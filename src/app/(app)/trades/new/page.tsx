import { TradeForm } from "@/components/TradeForm";

export default function NewTradePage() {
  return (
    <div className="space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow mb-3">New record / Trade docket</p>
          <h1>Add trade</h1>
          <p className="page-description">Calculate from saved symbol settings or copy the final P&amp;L from your broker—no pip math required. Drafts stay local until the server confirms the record.</p>
        </div>
      </div>
      <TradeForm />
    </div>
  );
}
