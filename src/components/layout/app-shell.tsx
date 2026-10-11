"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  NotebookPen,
  History,
  Phone,
  Settings,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { LogoLockup, LogoMark } from "@/components/brand/logo";
import { useApp } from "@/components/providers/app-context";
import { useTheme } from "@/components/theme/theme-provider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { IconTooltip } from "@/components/ui/tooltip";
import { Footer } from "@/components/layout/footer";

const NAV = [
  { href: "/notebook", label: "Digital Notebook", icon: NotebookPen },
  { href: "/history", label: "Order History", icon: History },
  { href: "/contact", label: "Contact Us", icon: Phone },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="Primary">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-soft text-primary dark:bg-primary/15"
                : "text-brand-muted hover:bg-secondary hover:text-brand-navy dark:hover:text-foreground"
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminMenu() {
  const { admin } = useApp();
  const { theme, toggle } = useTheme();
  const router = useRouter();

  async function logout() {
    await api.logout();
    router.replace("/login");
    router.refresh();
  }

  const initials = admin.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-secondary">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials || "A"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-brand-navy dark:text-foreground">
              {admin.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {admin.email}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Signed in as administrator</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggle}>
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {theme === "dark" ? "Light theme" : "Dark theme"}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onClick={logout}>
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { settings } = useApp();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/notebook" aria-label="Go to notebook">
            <LogoLockup
              businessName={settings.businessName}
              logoDataUrl={settings.logoDataUrl || undefined}
            />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <NavLinks />
        </div>
        <div className="border-t border-border p-3">
          <AdminMenu />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-md hover:bg-secondary"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/notebook" className="flex items-center gap-2" aria-label="Notebook">
          <LogoMark size={28} />
          <span className="font-semibold text-brand-navy dark:text-foreground">
            {settings.businessName}
          </span>
        </Link>
        <IconTooltip label={theme === "dark" ? "Light theme" : "Dark theme"}>
          <button
            onClick={toggle}
            className="grid h-9 w-9 place-items-center rounded-md hover:bg-secondary"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </IconTooltip>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-brand-navy/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-card shadow-xl animate-slide-in-right">
            <div className="flex h-16 items-center justify-between px-4">
              <LogoLockup
                size={32}
                businessName={settings.businessName}
                logoDataUrl={settings.logoDataUrl || undefined}
              />
              <button
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md hover:bg-secondary"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-border p-3">
              <AdminMenu />
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="flex min-h-dvh flex-col">
          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
