import Decimal from "decimal.js";

export const CASH_FLOW_TYPES = ["deposit", "withdrawal", "dividend", "fee", "payout", "adjustment"] as const;
export type CashFlowType = (typeof CASH_FLOW_TYPES)[number];

/** Return the signed account-currency amount stored by the cash ledger. */
export function signedCashFlowAmount(type: CashFlowType, value: string | number) {
  let amount: Decimal;
  try {
    amount = new Decimal(value);
  } catch {
    throw new Error("Cash-flow amount must be a finite number");
  }
  if (!amount.isFinite()) throw new Error("Cash-flow amount must be a finite number");
  if (type === "adjustment") {
    if (amount.isZero()) throw new Error("An adjustment must be non-zero");
    const rounded = amount.toFixed(2);
    if (new Decimal(rounded).isZero()) throw new Error("Cash-flow amount must be at least 0.01");
    return rounded;
  }
  if (amount.lte(0)) throw new Error("Enter a positive amount; the cash-flow type supplies its direction");
  const signed = type === "withdrawal" || type === "fee" || type === "payout" ? amount.neg() : amount;
  const rounded = signed.toFixed(2);
  if (new Decimal(rounded).isZero()) throw new Error("Cash-flow amount must be at least 0.01");
  return rounded;
}

export function cashFlowLabel(type: CashFlowType) {
  return {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    dividend: "Dividend",
    fee: "Fee / charge",
    payout: "Prop payout (cash out)",
    adjustment: "Balance adjustment",
  }[type];
}
