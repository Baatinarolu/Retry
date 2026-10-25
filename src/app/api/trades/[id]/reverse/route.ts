import { jsonError, requireUser } from "@/lib/api";
import { reverseTrade } from "@/lib/trade-service";
import { reversalSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const { id } = await ctx.params;
  const parsed = reversalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid reversal payload");
  try {
    const result = await reverseTrade(session!.uid, id, parsed.data);
    if (!result) return jsonError("Trade not found", 404);
    return NextResponse.json(result, { status: 201 });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not reverse trade");
  }
}
