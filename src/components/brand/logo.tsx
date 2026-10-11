import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Original geometric emblem for Gokul Gruh Udhyog.
 * A rounded tile (brand blue) holding an open-notebook motif with a
 * binding spine and three record lines, and a subtle teal "check" mark
 * evoking organized, verified records. Scales crisply at any size.
 */
export function LogoMark({
  size = 36,
  className,
  rounded = 10,
}: {
  size?: number;
  className?: string;
  rounded?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Gokul Gruh Udhyog logo"
    >
      <rect width="48" height="48" rx={rounded} fill="#426BCE" />
      <rect width="48" height="48" rx={rounded} fill="url(#ggu_grad)" fillOpacity="0.18" />
      {/* notebook pages */}
      <rect x="11" y="12" width="26" height="24" rx="3" fill="#FFFFFF" />
      {/* binding spine */}
      <rect x="22.6" y="12" width="2.8" height="24" fill="#EAF1FF" />
      {/* record lines (left page) */}
      <rect x="14.5" y="17" width="5.5" height="1.8" rx="0.9" fill="#8FA8E6" />
      <rect x="14.5" y="21" width="5.5" height="1.8" rx="0.9" fill="#C4D2F3" />
      <rect x="14.5" y="25" width="5.5" height="1.8" rx="0.9" fill="#C4D2F3" />
      {/* teal verified check (right page) */}
      <path
        d="M27.5 24.3l2.2 2.3 4.1-4.6"
        stroke="#3C9C91"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="27.6" y="17" width="6.4" height="1.8" rx="0.9" fill="#C4D2F3" />
      <defs>
        <linearGradient id="ggu_grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#24324B" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Full brand lockup: emblem + wordmark. */
export function LogoLockup({
  size = 36,
  className,
  subtitle = true,
  businessName = "Gokul Gruh Udhyog",
  logoDataUrl,
}: {
  size?: number;
  className?: string;
  subtitle?: boolean;
  businessName?: string;
  logoDataUrl?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {logoDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoDataUrl}
          alt={`${businessName} logo`}
          width={size}
          height={size}
          className="rounded-lg object-contain"
          style={{ width: size, height: size }}
        />
      ) : (
        <LogoMark size={size} />
      )}
      <div className="flex flex-col leading-tight">
        <span className="font-semibold text-brand-navy dark:text-foreground tracking-tight">
          {businessName}
        </span>
        {subtitle && (
          <span className="text-[11px] text-muted-foreground -mt-0.5">
            Customer Order Management
          </span>
        )}
      </div>
    </div>
  );
}
