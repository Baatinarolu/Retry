"use client";

import { Banner } from "@/components/ui";
import { isFxReportingError } from "@/lib/reporting-error";
import Link from "next/link";

export function ReportingErrorBanner({ message }: { message: string }) {
  const showFxRecovery = isFxReportingError(message);
  return (
    <Banner tone="warn">
      <div className="space-y-3">
        <p>{message}</p>
        {showFxRecovery ? (
          <div className="space-y-2 text-sm leading-6">
            <p><strong>Choose one way to continue:</strong> select a single account in the report filters to keep that report in its native currency, or add a real dated reporting rate for mixed-account totals.</p>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/reports" className="font-semibold underline underline-offset-4">Open report filters</Link>
              <Link href="/settings#fx-rates" className="font-semibold underline underline-offset-4">Open Settings → FX rate book</Link>
            </p>
            <p>Use the pair and deadline named in the error. For USD → NGN, the rate means <strong>1 USD = rate NGN</strong>. Historical trades can require older effective timestamps.</p>
            <p className="text-xs">TradeMind never guesses a missing exchange rate or rewrites the native account ledger.</p>
          </div>
        ) : null}
      </div>
    </Banner>
  );
}
