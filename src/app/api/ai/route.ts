import { db } from "@/db";
import { aiReviews } from "@/db/schema";
import { jsonError, parseFilters, requireUser } from "@/lib/api";
import { buildAnalytics, ruleBasedCoach } from "@/lib/analytics";
import { generateCoachReview } from "@/lib/coach";
import { rateLimit } from "@/lib/auth";
import { loadTradeRows, reportingContextFor } from "@/lib/queries";
import { shiftCalendarDate, zonedDayKey } from "@/lib/reporting";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;
  const reviews = await db
    .select()
    .from(aiReviews)
    .where(eq(aiReviews.userId, session!.uid))
    .orderBy(desc(aiReviews.createdAt))
    .limit(20);
  return NextResponse.json({ reviews });
}

export async function POST(req: NextRequest) {
  const { session, user, error } = await requireUser();
  if (error) return error;
  if (!rateLimit(`ai:${session!.uid}`, 10).ok) return jsonError("Too many reviews. Try again shortly.", 429);
  const body = await req.json().catch(() => ({}));
  const type = String(body.type || "review");
  if (!["review", "weekly", "monthly", "psychology"].includes(type)) return jsonError("Invalid review type");
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length > 2000) return jsonError("Question must be 2,000 characters or fewer");
  const filters = parseFilters(new URL(req.url));
  if (body.from) filters.from = body.from;
  if (body.to) filters.to = body.to;
  const timeZone = user!.timezone;
  if (type === "weekly" || type === "monthly") {
    const today = zonedDayKey(new Date(), timeZone);
    filters.to = today;
    filters.from = type === "weekly" ? shiftCalendarDate(today, -6) : `${today.slice(0, 7)}-01`;
    filters.dateField = "exit";
  }
  const context = await reportingContextFor(session!.uid, filters.accountId);
  const rows = await loadTradeRows(session!.uid, filters, timeZone);
  const analytics = buildAnalytics(rows, context.startingBalance, timeZone);
  const facts = ruleBasedCoach({
    question,
    stats: analytics.stats,
    insights: analytics.insights,
    byInstrument: analytics.byInstrument,
    bySession: analytics.bySession,
    byStrategy: analytics.byStrategy,
    mistakes: analytics.mistakes,
    sampleSize: rows.length,
    dateFrom: filters.from,
    dateTo: filters.to,
    currency: context.currency,
    timeZone,
  });

  const coach = await generateCoachReview({
    facts,
    question,
    permission: Boolean(user!.aiPermission),
  });
  const { content, source } = coach;

  const [review] = await db
    .insert(aiReviews)
    .values({
      userId: session!.uid,
      type,
      dateFrom: filters.from || null,
      dateTo: filters.to || null,
      sampleSize: rows.length,
      content,
      source,
    })
    .returning();

  return NextResponse.json({ review, usedLlm: source === "llm", provider: coach.provider });
}
