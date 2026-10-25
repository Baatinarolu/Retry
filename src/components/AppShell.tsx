"use client";

import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/format";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  NotebookPen,
  PlusCircle,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
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
  NotebookPen,
  PlusCircle,
  BarChart3,
  Brain,
  FlaskConical,
  CalendarDays,
  History,
  Sparkles,
  FileText,
  Shield,
  Settings,
};

const PRIMARY_ITEMS = NAV_ITEMS.slice(0, 6);
const SECONDARY_ITEMS = NAV_ITEMS.slice(6);
const DRAFT_KEY = "tm-trade-draft";
const DRAFT_EVENT = "tm-draft-change";
const THEME_EVENT = "tm-theme-change";

type Theme = "light" | "dark";
type User = {
  id: string;
  name: string;
  email: string;
  theme: string;
  demoMode: boolean;
  aiPermission: boolean;
  baseCurrency: string;
};

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

function applyTheme(theme: Theme) {
  window.localStorage.setItem("tm-theme", theme);
  document.documentElement.className = theme;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [moreOpen, setMoreOpen] = useState(false);
  const offline = useSyncExternalStore(subscribeOnline, () => !navigator.onLine, () => false);
  const draftPending = useSyncExternalStore(
    subscribeDraft,
    () => Boolean(localStorage.getItem(DRAFT_KEY)),
    () => false,
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => {
        if (!response.ok) throw new Error("Not authenticated");
        return response.json();
      })
      .then((data) => {
        setUser(data.user);
        const saved = window.localStorage.getItem("tm-theme");
        const next: Theme = saved === "light" || saved === "dark" ? saved : data.user?.theme === "dark" ? "dark" : "light";
        setTheme(next);
        applyTheme(next);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onThemeChange = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (next === "light" || next === "dark") setTheme(next);
    };
    window.addEventListener(THEME_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_EVENT, onThemeChange);
  }, []);

  const initials = useMemo(
    () => (user?.name || "T").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
    [user],
  );

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  function NavLink({ item, mobile = false }: { item: (typeof NAV_ITEMS)[number]; mobile?: boolean }) {
    const Icon = ICONS[item.icon as keyof typeof ICONS] || BookOpen;
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        onClick={() => setMoreOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          mobile ? "mobile-nav-link" : "sidebar-link",
          active && (mobile ? "mobile-nav-link-active" : "sidebar-link-active"),
        )}
      >
        <Icon className={mobile ? "h-5 w-5" : "h-4 w-4"} strokeWidth={1.6} />
        <span className={mobile ? "text-[9px] font-medium uppercase tracking-[0.06em]" : ""}>{item.label}</span>
      </Link>
    );
  }

  const currentSection = NAV_ITEMS.find((item) => isActive(item.href))?.label || "Workspace";

  return (
    <div className="app-shell">
      <aside className="app-sidebar no-print">
        <Link href="/dashboard" className="brand-lockup px-1" aria-label="TradeMind dashboard">
          <Image src="/logo.png" alt="" width={40} height={40} className="brand-mark h-10 w-10" priority />
          <span>
            <span className="brand-wordmark">{APP_NAME}</span>
            <span className="brand-subtitle">Trading journal</span>
          </span>
        </Link>

        <div className="mt-9 flex items-center justify-between px-3">
          <p className="eyebrow">Your workspace</p>
          <span className="font-mono text-[9px] text-[var(--faint)]">01</span>
        </div>
        <nav className="mt-3 space-y-1" aria-label="Primary navigation">
          {PRIMARY_ITEMS.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>

        <div className="my-5 border-t border-[var(--line)]" />
        <button className="sidebar-link w-full" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen}>
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.6} />
          More tools
        </button>
        {moreOpen ? (
          <div className="mt-1 space-y-1 border-l border-[var(--line)] pl-2">
            {SECONDARY_ITEMS.map((item) => <NavLink key={item.href} item={item} />)}
          </div>
        ) : null}

        <div className="sidebar-footer">
          <div className="flex items-start gap-2 text-[var(--muted)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
            <p className="text-xs leading-5">Your private space to review the work behind the result.</p>
          </div>
          <a
            href="https://github.com/Baatinarolu/Retry"
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--accent)]"
          >
            Open source <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="app-topbar no-print">
          <div>
            <Link href="/dashboard" className="brand-lockup lg:hidden">
              <Image src="/logo.png" alt="" width={34} height={34} className="brand-mark h-[34px] w-[34px]" />
              <span className="brand-wordmark">{APP_NAME}</span>
            </Link>
            <div className="hidden lg:block">
              <p className="eyebrow">{currentSection}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Process over prediction · {new Date().getUTCFullYear()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {offline ? <span className="badge border-[var(--gold)] text-[var(--gold)]"><WifiOff className="mr-1 h-3 w-3" /> Offline</span> : null}
            {draftPending ? <Link href="/trades/new" className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--accent)] sm:block">Local draft</Link> : null}
            <div className="mr-1 hidden items-center gap-2 border-l border-[var(--line)] pl-3 md:flex">
              <span className="grid h-7 w-7 place-items-center border border-[var(--line)] bg-[var(--surface)] font-mono text-[10px]">{initials}</span>
              <span className="max-w-36 truncate text-xs text-[var(--muted)]">{user?.name}</span>
            </div>
            <button className="icon-btn" onClick={toggleTheme} title="Toggle color theme" aria-label="Toggle color theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button className="icon-btn" onClick={signOut} title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1480px] px-4 pb-24 pt-7 sm:px-6 lg:px-9 lg:pb-14 lg:pt-10">
          {user?.demoMode ? (
            <div className="banner banner-warn no-print mb-6">Demo mode — shared sample workspace; do not enter private data.</div>
          ) : null}
          {children}
        </main>
      </div>

      <nav className="mobile-nav no-print" aria-label="Mobile navigation">
        {PRIMARY_ITEMS.slice(0, 4).map((item) => <NavLink key={item.href} item={item} mobile />)}
        <button
          className={cn("mobile-nav-link", (moreOpen || SECONDARY_ITEMS.some((item) => isActive(item.href))) && "mobile-nav-link-active")}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
        >
          <Menu className="h-5 w-5" strokeWidth={1.6} />
          <span className="text-[9px] font-medium uppercase tracking-[0.06em]">More</span>
        </button>
      </nav>

      {moreOpen ? (
        <div className="mobile-more no-print lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow">More tools</p>
            <button className="icon-btn h-7 w-7" onClick={() => setMoreOpen(false)} aria-label="Close more tools">
              <X className="h-4 w-4" />
            </button>
          </div>
          {SECONDARY_ITEMS.map((item) => {
            const Icon = ICONS[item.icon as keyof typeof ICONS] || Settings;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn("sidebar-link", isActive(item.href) && "sidebar-link-active")}
              >
                <Icon className="h-4 w-4" strokeWidth={1.6} /> {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
