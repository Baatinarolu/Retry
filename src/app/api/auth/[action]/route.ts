import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { clearSessionCookie, hashPassword, setSessionCookie, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { seedDemoTrades } from "@/lib/demo-data";
import { provisionNewUser } from "@/lib/onboarding";
import { forgotSchema, loginSchema, resetSchema, signupSchema } from "@/lib/validations";
import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function ipOf(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const limited = await rateLimit(`auth:${action}:${ipOf(req)}`, action === "login" ? 12 : 20, 60_000).catch(() => null);
  if (!limited) return NextResponse.json({ error: "Rate limiting is temporarily unavailable. Try again shortly." }, { status: 503 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  if (action === "logout") {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  }

  if (action === "demo") {
    const email = "demo@trademind.app";
    let [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      const passwordHash = await hashPassword("demo-trademind");
      [user] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          name: "Demo Trader",
          emailVerified: true,
          timezone: "Africa/Lagos",
          baseCurrency: "USD",
          demoMode: true,
          onboardingComplete: true,
        })
        .returning();
      await provisionNewUser(user.id, "USD");
    }
    await seedDemoTrades(user.id);
    await setSessionCookie({ uid: user.id, email: user.email, name: user.name, ver: user.sessionVersion });
    return NextResponse.json({ ok: true, demo: true, user: { id: user.id, email: user.email, name: user.name, demoMode: true } });
  }

  const body = await req.json().catch(() => ({}));

  if (action === "signup") {
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Check name, email, and password (min 8 characters)." }, { status: 400 });
    const email = parsed.data.email.toLowerCase().trim();
    const [exists] = await db.select().from(users).where(eq(users.email, email));
    if (exists) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    const passwordHash = await hashPassword(parsed.data.password);
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: parsed.data.name.trim(),
        emailVerified: true,
        timezone: parsed.data.timezone || "Africa/Lagos",
        baseCurrency: parsed.data.baseCurrency || "USD",
        onboardingComplete: true,
      })
      .returning();
    await provisionNewUser(user.id, user.baseCurrency);
    await setSessionCookie({ uid: user.id, email: user.email, name: user.name, ver: user.sessionVersion });
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  }

  if (action === "login") {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid credentials." }, { status: 400 });
    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase().trim()));
    if (!user) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    await setSessionCookie({ uid: user.id, email: user.email, name: user.name, ver: user.sessionVersion });
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, demoMode: user.demoMode } });
  }

  if (action === "forgot") {
    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase().trim()));
    if (!user) {
      return NextResponse.json({
        ok: true,
        message: "If that email exists, the reset request has been processed.",
      });
    }
    const raw = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    });
    const development = process.env.NODE_ENV !== "production";
    return NextResponse.json({
      ok: true,
      message: development
        ? "Development reset token created. It is returned once because email delivery is not configured."
        : "If that email exists, the reset request has been processed.",
      ...(development ? { token: raw, resetPath: `/reset-password?token=${raw}` } : {}),
    });
  }

  if (action === "reset") {
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Token and new password required." }, { status: 400 });
    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const passwordHash = await hashPassword(parsed.data.password);
    const updated = await db.transaction(async (tx) => {
      const now = new Date();
      // Claim and consume the token in one statement so concurrent requests cannot both succeed.
      const [row] = await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, now),
          ),
        )
        .returning();
      if (!row) return false;
      await tx
        .update(users)
        .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now })
        .where(eq(users.id, row.userId));
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(and(eq(passwordResetTokens.userId, row.userId), isNull(passwordResetTokens.usedAt)));
      return true;
    });
    if (!updated) return NextResponse.json({ error: "Reset token is invalid or expired." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 404 });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action !== "me") return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  const [user] = await db.select().from(users).where(eq(users.id, session.uid));
  if (!user || user.sessionVersion !== session.ver) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      theme: user.theme,
      dateFormat: user.dateFormat,
      timeFormat: user.timeFormat,
      baseCurrency: user.baseCurrency,
      aiPermission: user.aiPermission,
      demoMode: user.demoMode,
    },
  });
}
