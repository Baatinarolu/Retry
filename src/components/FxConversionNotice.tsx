"use client";

import { Banner } from "@/components/ui";

export function FxConversionNotice({ conversion }: { conversion?: {
  enabled: boolean;
  targetCurrency: string;
  rateCount: number;
} | null }) {
  if (!conversion?.enabled) return null;
  return (
    <Banner>
      Mixed-account totals are reported in {conversion.targetCurrency} from your saved manual FX rate book ({conversion.rateCount} entries). Each trade uses the latest rate effective on or before its realization; starting balances use the report-time rate. Native account ledgers are unchanged.
    </Banner>
  );
}
