"use client";

import { Button, Field, Input } from "@/components/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetForm() {
  const tokenFromUrl = useSearchParams().get("token") || "";
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      setMessage(res.ok ? "Password updated. You can sign in." : data.error || "Reset failed");
    } catch {
      setMessage("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card auth-panel w-full space-y-4 p-6 sm:p-8">
      <p className="eyebrow">Account recovery</p>
      <h1 className="text-4xl">New password</h1>
      <Field label="Token">
        <Input value={token} onChange={(e) => setToken(e.target.value)} required />
      </Field>
      <Field label="New password">
        <Input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Button type="submit" loading={loading} className="w-full">
        Update password
      </Button>
      {message ? <p className="text-sm">{message}</p> : null}
      <Link href="/login" className="text-sm text-[var(--muted)]">
        Sign in
      </Link>
    </form>
  );
}

export default function ResetPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4">
      <div className="w-full">
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
