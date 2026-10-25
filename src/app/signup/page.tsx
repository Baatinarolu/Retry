"use client";

import { Button, Field, Input, Select } from "@/components/ui";
import { APP_NAME, CURRENCIES, TIMEZONES } from "@/lib/constants";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    timezone: "Africa/Lagos",
    baseCurrency: "USD",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create account");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-4">
      <form onSubmit={submit} className="card w-full space-y-4 p-6">
        <Link href="/" className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
          {APP_NAME}
        </Link>
        <h1 className="text-2xl font-semibold">Create your journal</h1>
        <p className="text-sm text-[var(--muted)]">Passwords are hashed. Each account only sees its own trades.</p>
        <Field label="Name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password" hint="Minimum 8 characters">
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
        </Field>
        <Field label="Timezone">
          <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            {TIMEZONES.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </Select>
        </Field>
        <Field label="Base currency">
          <Select value={form.baseCurrency} onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}>
            {CURRENCIES.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </Select>
        </Field>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
        <p className="text-sm text-[var(--muted)]">
          Already journaling? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
