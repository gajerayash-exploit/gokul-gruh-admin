"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DayBadgeProps {
  day: string;
  variant?: "table" | "header";
  className?: string;
}

/**
 * Simple plain-text day display — no badge, no color, just the English
 * weekday name rendered consistently with the rest of the UI fields.
 */
export function DayBadge({ day, className }: DayBadgeProps) {
  if (!day) return <span className="text-muted-foreground/60">—</span>;

  return (
    <span className={cn("text-sm text-foreground", className)}>
      {day}
    </span>
  );
}

