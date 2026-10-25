"use client";

import { DemoButton } from "@/components/DemoButton";
import { Button, Field, Input } from "@/components/ui";
import { APP_NAME } from "@/lib/constants";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const requestedNext = useSearchParams().get("next") || "/dashboard";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign-in failed");
        return;
      }
      router.push(next);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card auth-panel space-y-5 p-6 sm:p-8">
      <div className="border-b border-[var(--line)] pb-5">
        <p className="eyebrow mb-2">Return to the record</p>
        <h1 className="text-4xl">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Your trades, notes, and reviews—in one private workspace.</p>
      </div>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error ? <p className="border-l-2 border-[var(--red)] pl-3 text-sm text-[var(--red)]">{error}</p> : null}
      <Button type="submit" loading={loading} className="w-full">
        Continue
      </Button>
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <Link href="/forgot-password">Forgot password</Link>
        <Link href="/signup">Create account</Link>
      </div>
      <DemoButton />
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4 py-10">
      <div className="w-full space-y-6">
        <Link href="/" className="brand-lockup justify-center">
          <Image src="/logo.png" alt="" width={40} height={40} className="brand-mark h-10 w-10" />
          <span>
            <span className="brand-wordmark">{APP_NAME}</span>
            <span className="brand-subtitle">Trading journal</span>
          </span>
        </Link>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
