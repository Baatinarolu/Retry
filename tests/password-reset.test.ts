import assert from "node:assert/strict";
import test from "node:test";
import {
  PasswordResetDeliveryError,
  passwordResetBaseUrl,
  passwordResetDeliveryConfigured,
  sendPasswordResetEmail,
} from "../src/lib/password-reset";

const deliveryEnv = {
  RESEND_API_KEY: "test-server-key",
  PASSWORD_RESET_FROM_EMAIL: "TradeMind < resets@example.test >",
};

test("password-reset delivery requires both server settings and a valid app URL", () => {
  assert.equal(passwordResetDeliveryConfigured({}), false);
  assert.equal(passwordResetDeliveryConfigured({ RESEND_API_KEY: "key" }), false);
  assert.equal(passwordResetDeliveryConfigured(deliveryEnv), true);
  assert.equal(passwordResetBaseUrl({ NEXT_PUBLIC_APP_URL: "https://journal.example.test/" }), "https://journal.example.test");
  assert.equal(passwordResetBaseUrl({ NEXT_PUBLIC_APP_URL: "javascript:alert(1)" }), null);
  assert.equal(passwordResetBaseUrl({}), null);
});

test("reset email uses the server-only HTTPS adapter and escapes the reset link", async () => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  await sendPasswordResetEmail(
    { email: "trader@example.test", resetUrl: "https://journal.example.test/reset-password?token=a&b=<safe>" },
    {
      env: deliveryEnv,
      fetchImpl: async (input, init) => {
        requests.push({ input, init });
        return new Response("{}", { status: 200 });
      },
    },
  );
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.equal(String(request.input), "https://api.resend.com/emails");
  assert.equal(request.init?.method, "POST");
  assert.equal((request.init?.headers as Record<string, string>).Authorization, "Bearer test-server-key");
  const payload = JSON.parse(String(request.init?.body));
  assert.deepEqual(payload.to, ["trader@example.test"]);
  assert.match(payload.text, /token=a&b=<safe>/);
  assert.match(payload.html, /token=a&amp;b=&lt;safe&gt;/);
  assert.equal(payload.html.includes("token=a&b=<safe>"), false);
});

test("failed or unconfigured delivery fails closed without exposing credentials", async () => {
  let called = false;
  await assert.rejects(
    sendPasswordResetEmail(
      { email: "trader@example.test", resetUrl: "https://journal.example.test/reset-password?token=secret" },
      { env: {}, fetchImpl: async () => { called = true; return new Response(); } },
    ),
    PasswordResetDeliveryError,
  );
  assert.equal(called, false);
  await assert.rejects(
    sendPasswordResetEmail(
      { email: "trader@example.test", resetUrl: "https://journal.example.test/reset-password?token=secret" },
      { env: deliveryEnv, fetchImpl: async () => new Response("provider detail", { status: 429 }) },
    ),
    (error: unknown) => error instanceof PasswordResetDeliveryError && !error.message.includes("test-server-key") && !error.message.includes("provider detail"),
  );
});
