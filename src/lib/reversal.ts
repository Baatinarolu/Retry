import {
  calculateExecutionLedger,
  type ExecutionFill,
  type ExecutionLedgerInput,
} from "@/lib/execution-ledger";

export type ReversalInput = {
  executedAt: string | Date;
  closePrice: string | number;
  entryPrice: string | number;
  /** Quantity of the new opposite-direction position. */
  quantity: string | number;
  closeFees?: string | number;
  entryFees?: string | number;
  stopLoss?: string | number | null;
  takeProfit?: string | number | null;
  closeNotes?: string;
  entryNotes?: string;
};

/**
 * Close the remaining quantity of one open trade and open a separate opposite
 * trade. The original ledger remains same-direction; no flat-trade reopening
 * or mixed-direction stream is introduced.
 */
export function calculateReversal(currentInput: ExecutionLedgerInput, input: ReversalInput) {
  const current = calculateExecutionLedger(currentInput);
  if (current.status !== "open") throw new Error("Only an open execution-led trade can be reversed");
  const executedAt = input.executedAt instanceof Date ? new Date(input.executedAt) : new Date(input.executedAt);
  if (Number.isNaN(executedAt.getTime())) throw new Error("Reversal has an invalid date/time");
  if (executedAt.getTime() <= current.lastExecutionAt.getTime()) {
    throw new Error("Reversal time must be later than the trade's last execution");
  }

  const closeFill: ExecutionFill = {
    type: "exit",
    price: input.closePrice,
    quantity: current.remainingQuantity,
    executedAt,
    fees: input.closeFees,
    notes: input.closeNotes || "Reversal close",
  };
  const closed = calculateExecutionLedger({
    ...currentInput,
    status: "closed",
    executions: [...current.executions, closeFill],
  });

  const entryFill: ExecutionFill = {
    type: "entry",
    price: input.entryPrice,
    quantity: input.quantity,
    executedAt,
    fees: input.entryFees,
    notes: input.entryNotes || "Reversal entry",
  };
  const opened = calculateExecutionLedger({
    ...currentInput,
    direction: currentInput.direction === "long" ? "short" : "long",
    status: "open",
    executions: [entryFill],
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    commission: "0",
    swap: "0",
    slippage: "0",
    overrideNetPnl: null,
  });

  return {
    current,
    closed,
    opened,
    closeExecution: closed.executions[closed.executions.length - 1],
    entryExecution: opened.executions[0],
  };
}
