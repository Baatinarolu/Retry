import Decimal from "decimal.js";

export type FxRateInput = {
  fromCurrency: string;
  toCurrency: string;
  rate: string | number;
  effectiveAt: string | Date;
  source?: string;
  notes?: string;
};

export type NormalizedFxRate = {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveAt: Date;
  source: string;
  notes: string;
};

export type FxConversionRate = Pick<FxRateInput, "fromCurrency" | "toCurrency" | "rate" | "effectiveAt">;

export function normalizeCurrencyCode(value: string, label = "Currency") {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3,8}$/.test(normalized)) throw new Error(`${label} must be 3–8 letters`);
  return normalized;
}

export function normalizeFxRate(input: FxRateInput): NormalizedFxRate {
  const fromCurrency = normalizeCurrencyCode(input.fromCurrency, "Source currency");
  const toCurrency = normalizeCurrencyCode(input.toCurrency, "Target currency");
  if (fromCurrency === toCurrency) throw new Error("Source and target currencies must differ");
  const effectiveAt = input.effectiveAt instanceof Date ? new Date(input.effectiveAt) : new Date(input.effectiveAt);
  if (Number.isNaN(effectiveAt.getTime())) throw new Error("FX rate has an invalid effective date/time");
  let rate: Decimal;
  try {
    rate = new Decimal(input.rate);
  } catch {
    throw new Error("FX rate must be a finite number");
  }
  if (!rate.isFinite() || rate.lte(0)) throw new Error("FX rate must be greater than zero");
  const normalizedRate = rate.toFixed(12);
  const storedRate = new Decimal(normalizedRate);
  if (storedRate.lte(0)) throw new Error("FX rate is too small to store");
  if (storedRate.gte("1000000000000")) throw new Error("FX rate is too large to store");
  const source = (input.source || "manual").trim();
  if (!source || source.length > 80) throw new Error("FX rate source must be 1–80 characters");
  const notes = input.notes || "";
  if (notes.length > 500) throw new Error("FX rate notes must be 500 characters or fewer");
  return { fromCurrency, toCurrency, rate: normalizedRate, effectiveAt, source, notes };
}

function rateDecimal(rate: string | number) {
  try {
    const value = new Decimal(rate);
    if (!value.isFinite() || value.lte(0)) throw new Error("invalid");
    return value;
  } catch {
    throw new Error("FX rate book contains an invalid rate");
  }
}

function rateDate(value: string | Date) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("FX rate book contains an invalid effective date/time");
  return date;
}

function latestRate(
  rates: FxConversionRate[],
  fromCurrency: string,
  toCurrency: string,
  at: number,
) {
  const candidates = rates
    .filter((rate) =>
      rate.fromCurrency.trim().toUpperCase() === fromCurrency &&
      rate.toCurrency.trim().toUpperCase() === toCurrency &&
      rateDate(rate.effectiveAt).getTime() <= at,
    )
    .map((rate) => ({ rate: rateDecimal(rate.rate), effectiveAt: rateDate(rate.effectiveAt) }))
    .sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime());
  if (!candidates.length) return null;
  const latest = candidates[candidates.length - 1];
  for (let index = candidates.length - 2; index >= 0; index--) {
    const candidate = candidates[index];
    if (candidate.effectiveAt.getTime() !== latest.effectiveAt.getTime()) break;
    if (!candidate.rate.eq(latest.rate)) throw new Error(`Conflicting FX rates for ${fromCurrency} → ${toCurrency} at the same effective time`);
  }
  return latest;
}

/** Convert with a dated direct rate, or a non-conflicting reciprocal quote. */
export function convertCurrency(
  amount: string | number | Decimal,
  fromCurrency: string,
  toCurrency: string,
  at: string | Date,
  rates: FxConversionRate[],
) {
  let value: Decimal;
  try {
    value = new Decimal(amount);
  } catch {
    throw new Error("Amount to convert must be a finite number");
  }
  if (!value.isFinite()) throw new Error("Amount to convert must be a finite number");
  const from = normalizeCurrencyCode(fromCurrency, "Source currency");
  const to = normalizeCurrencyCode(toCurrency, "Target currency");
  const date = rateDate(at);
  if (from === to) return value;
  const time = date.getTime();
  const direct = latestRate(rates, from, to, time);
  const inverse = latestRate(rates, to, from, time);
  if (direct && inverse && !direct.rate.mul(inverse.rate).minus(1).abs().lte("0.00000001")) {
    throw new Error(`Conflicting direct and inverse FX rates for ${from} → ${to}; keep one consistent quote`);
  }
  if (direct) return value.mul(direct.rate);
  if (inverse) return value.div(inverse.rate);
  throw new Error(`Missing FX rate for ${from} → ${to} effective on or before ${date.toISOString()}`);
}

export function convertStartingBalancesToCurrency(
  accounts: Array<{ name: string; currency: string; startingBalance: string }>,
  targetCurrency: string,
  asOf: string | Date,
  rates: FxConversionRate[],
) {
  const target = normalizeCurrencyCode(targetCurrency, "Target currency");
  return accounts.reduce((total, account) => {
    try {
      return total.plus(convertCurrency(account.startingBalance, account.currency, target, asOf, rates));
    } catch (cause) {
      throw new Error(`${account.name} starting balance (report time): ${cause instanceof Error ? cause.message : "FX conversion failed"}`);
    }
  }, new Decimal(0)).toFixed(2);
}

export type FxTradeRow = {
  displayId: string;
  accountCurrency?: string | null;
  reportingCurrency?: string;
  netPnl: string | number;
  grossPnl: string | number;
  entryAt: Date;
  exitAt?: Date | null;
  realizedAt?: Date | null;
};

/** Convert closed-trade money fields while preserving native account metadata and R. */
export function convertTradeRowsToCurrency<T extends FxTradeRow>(
  rows: T[],
  targetCurrency: string,
  rates: FxConversionRate[],
): Array<T & { reportingCurrency: string }> {
  const target = normalizeCurrencyCode(targetCurrency, "Target currency");
  return rows.map((row) => {
    if (!row.accountCurrency) throw new Error(`${row.displayId} has no account currency`);
    const at = row.realizedAt ?? row.exitAt ?? row.entryAt;
    try {
      return {
        ...row,
        netPnl: convertCurrency(row.netPnl, row.accountCurrency, target, at, rates).toFixed(4),
        grossPnl: convertCurrency(row.grossPnl, row.accountCurrency, target, at, rates).toFixed(4),
        reportingCurrency: target,
      };
    } catch (cause) {
      throw new Error(`${row.displayId}: ${cause instanceof Error ? cause.message : "FX conversion failed"}`);
    }
  });
}
