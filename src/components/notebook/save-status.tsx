"use client";

import { Check, Loader2, CircleAlert, PencilLine, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveState } from "@/types";
import { formatClockTime } from "@/lib/dates";

export function SaveStatus({
  state,
  lastSavedAt,
  onRetry,
  compact = false,
  className,
}: {
  state: SaveState;
  lastSavedAt?: string | null;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const map = {
    idle: { icon: PencilLine, text: "Ready", cls: "text-muted-foreground" },
    draft: { icon: PencilLine, text: "Draft", cls: "text-warning-foreground" },
    saving: { icon: Loader2, text: "Saving…", cls: "text-primary" },
    saved: { icon: Check, text: "Saved", cls: "text-success" },
    error: { icon: CircleAlert, text: "Save failed", cls: "text-destructive" },
  } as const;

  const { icon: Icon, text, cls } = map[state];
  const spin = state === "saving";

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cls, className)}
      role="status"
      aria-live="polite"
    >
      <Icon className={cn("h-3.5 w-3.5", spin && "animate-spin")} />
      {!compact && <span>{text}</span>}
      {state === "saved" && lastSavedAt && !compact && (
        <span className="text-muted-foreground font-normal">
          · {formatClockTime(lastSavedAt)}
        </span>
      )}
      {state === "error" && onRetry && (
        <button
          onClick={onRetry}
          className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-destructive hover:bg-destructive/10"
        >
          <RotateCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </span>
  );
}
