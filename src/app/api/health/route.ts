import { db } from "@/db";
import { verifyCalculationInvariants } from "@/lib/calculations";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    const calc = verifyCalculationInvariants();
    return Response.json({ ok: true, calc });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
