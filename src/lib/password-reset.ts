export type PasswordResetEnv = Record<string, string | undefined>;

export class PasswordResetDeliveryError extends Error {
  constructor() {
    super("Password reset email delivery is unavailable");
    this.name = "PasswordResetDeliveryError";
  }
}

export function passwordResetDeliveryConfigured(env: PasswordResetEnv = process.env) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.PASSWORD_RESET_FROM_EMAIL?.trim());
}

export function passwordResetBaseUrl(env: PasswordResetEnv = process.env) {
  const value = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? value : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (character) => entities[character] || character);
}

type DeliveryOptions = {
  env?: PasswordResetEnv;
  fetchImpl?: typeof fetch;
};

/** Server-only Resend HTTPS delivery; no SDK or client-side credentials are required. */
export async function sendPasswordResetEmail(
  { email, resetUrl }: { email: string; resetUrl: string },
  options: DeliveryOptions = {},
) {
  const env = options.env || process.env;
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.PASSWORD_RESET_FROM_EMAIL?.trim();
  if (!apiKey || !from) throw new PasswordResetDeliveryError();
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Reset your TradeMind password",
      text: `Reset your TradeMind password within 30 minutes: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>Reset your TradeMind password within 30 minutes:</p><p><a href="${escapeHtml(resetUrl)}">Choose a new password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    throw new PasswordResetDeliveryError();
  });
  if (!response.ok) throw new PasswordResetDeliveryError();
}
