"use client";

import Link from "next/link";
import { Phone } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { useApp } from "@/components/providers/app-context";

const APP_VERSION = "1.0.0";

export function Footer() {
  const { settings } = useApp();
  const year = new Date().getFullYear();

  return (
    <footer className="no-print mt-6 border-t border-border px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <LogoMark size={22} rounded={6} />
          <span className="font-medium text-brand-navy dark:text-foreground">
            {settings.businessName}
          </span>
          <span className="text-muted-foreground">· Customer Order Management</span>
        </div>
        <div className="flex items-center gap-4">
          {settings.phoneNumber && (
            <a
              href={`tel:${settings.phoneNumber.replace(/\s+/g, "")}`}
              className="flex items-center gap-1.5 hover:text-primary"
            >
              <Phone className="h-3.5 w-3.5" />
              {settings.phoneNumber}
            </a>
          )}
          <Link href="/contact" className="hover:text-primary">
            Contact Us
          </Link>
          <span>
            © {year} · v{APP_VERSION}
          </span>
        </div>
      </div>
    </footer>
  );
}
