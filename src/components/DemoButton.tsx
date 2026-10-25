"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";

export function DemoButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        className={className}
        loading={loading}
        onClick={async () => {
          setLoading(true);
          setError("");
          try {
            const res = await fetch("/api/auth/demo", { method: "POST" });
            if (!res.ok) {
              setError("Could not open demo");
              return;
            }
            router.push("/dashboard");
          } catch {
            setError("Network error. Check your connection and try again.");
          } finally {
            setLoading(false);
          }
        }}
      >
        Explore demo journal
      </Button>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
