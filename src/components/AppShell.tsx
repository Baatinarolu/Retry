"use client";

import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/format";
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  Menu,
  PlusCircle,
  Settings,
  Shield,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";

const ICONS = {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  CalendarDays,
  BarChart3,
  FlaskConical,
  History,
  Brain,
  Sparkles,
  FileText,
  Shield,
  Settings,
};

const DRAFT_KEY = "tm-trade-draft";
const DRAFT_EVENT = "tm-draft-change";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function subscribeDraft(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(DRAFT_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DRAFT_EVENT, callback);
  };
}

type User = {
  id: string;
  name: string;
  email: string;
  theme: string;
  demoMode: boolean;
  aiPermission: boolean;
  baseCurrency: string;
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const offline = useSyncExternalStore(subscribeOnline, () => !navigator.onLine, () => false);
  const draftPending = useSyncExternalStore(
    subscribeDraft,
    () => Boolean(localStorage.getItem(DRAFT_KEY)),
    () => false,
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setUser(d.user);
        document.documentElement.classList.toggle("light", d.user?.theme === "light");
        document.documentElement.classList.toggle("dark", d.user?.theme !== "light");
      })
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const initials = useMemo(() => (user?.name || "T").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(), [user]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[auto_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-[var(--border)] bg-[var(--bg-elev)] p-4 transition-transform lg:static lg:translate-x-0",
          collapsed && "lg:w-[4.6rem]",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="mb-6 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
            <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg object-cover" />
            {!collapsed ? (
              <div>
                <p className="text-sm font-semibold leading-tight">{APP_NAME}</p>
                <p className="text-[11px] text-[var(--muted)]">Process over prediction</p>
              </div>
            ) : null}
          </Link>
          <button className="btn btn-ghost hidden p-2 lg:inline-flex" onClick={() => setCollapsed((v) => !v)} aria-label="Collapse sidebar">
            <Menu className="h-4 w-4" />
          </button>
          <button className="btn btn-ghost p-2 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon as keyof typeof ICONS];
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("sidebar-link", active && "active")}
                title={item.label}
                onClick={() => setOpen(false)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      {open ? <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} /> : null}

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_86%,transparent)] px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="text-sm font-medium">{NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.label || "Workspace"}</p>
              {user?.demoMode ? <p className="text-[11px] text-amber-300">Demo mode — shared sample workspace; do not enter private data</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {offline ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            ) : null}
            {draftPending ? (
              <Link href="/trades/new" className="text-[11px] text-[var(--accent)]">
                Local draft
              </Link>
            ) : null}
            <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--bg-card-2)] text-xs">{initials}</span>
              <span className="hidden max-w-[10rem] truncate text-xs sm:inline">{user?.name}</span>
            </div>
            <button className="btn btn-ghost text-xs" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
