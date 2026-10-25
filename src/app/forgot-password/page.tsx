"use client";

import { Button, Field, Input } from "@/components/ui";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setToken("");
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message || data.error || "Check your inbox.");
      setToken(data.token || "");
    } catch {
      setMessage("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <form onSubmit={submit} className="card auth-panel w-full space-y-4 p-6 sm:p-8">
        <p className="eyebrow">Account recovery</p>
        <h1 className="text-4xl">Reset password</h1>
        <p className="text-sm text-[var(--muted)]">
          Request a one-time reset. In development, a token is shown here when email delivery is not configured.
        </p>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Button type="submit" loading={loading} className="w-full">
          Request reset
        </Button>
        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
        {token ? (
          <p className="break-all border border-[var(--line)] bg-[var(--bg-elev)] p-3 font-mono text-xs">
            Token: {token}
            <br />
            <Link href={`/reset-password?token=${token}`} className="text-[var(--accent)]">
              Continue to reset
            </Link>
          </p>
        ) : null}
        <Link href="/login" className="text-sm text-[var(--muted)]">
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
