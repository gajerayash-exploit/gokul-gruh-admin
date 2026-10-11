"use client";

import * as React from "react";
import { ListChecks, FileClock, CheckCircle2, Clock } from "lucide-react";
import { api } from "@/lib/api/client";
import { formatClockTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface Summary {
  totalToday: number;
  draftsToday: number;
  completeToday: number;
  lastSavedAt: string | null;
}

export function SummaryRow({ refreshKey }: { refreshKey?: string | number }) {
  const [s, setS] = React.useState<Summary | null>(null);

  React.useEffect(() => {
    let active = true;
    api
      .summary()
      .then((r) => active && setS(r))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const items = [
    { label: "Orders today", value: s?.totalToday ?? "—", icon: ListChecks, cls: "text-primary" },
    { label: "Drafts", value: s?.draftsToday ?? "—", icon: FileClock, cls: "text-warning-foreground" },
    { label: "Completed", value: s?.completeToday ?? "—", icon: CheckCircle2, cls: "text-success" },
    {
      label: "Last saved",
      value: s?.lastSavedAt ? formatClockTime(s.lastSavedAt) : "—",
      icon: Clock,
      cls: "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
        >
          <it.icon className={cn("h-4 w-4 shrink-0", it.cls)} />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold leading-tight text-brand-navy dark:text-foreground">
              {it.value}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">{it.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
