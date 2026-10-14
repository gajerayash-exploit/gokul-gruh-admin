"use client";

import * as React from "react";
import {
  ListChecks,
  FileClock,
  CheckCircle2,
  Clock,
  IndianRupee,
  TrendingUp,
  FileSpreadsheet,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { formatClockTime } from "@/lib/dates";
import { cn, formatINR } from "@/lib/utils";
import type { OrderDTO } from "@/types";

export interface SummaryRowProps {
  orders?: OrderDTO[];
  selectedDate?: string;
  refreshKey?: string | number;
  onOpenRevenueModal?: () => void;
  onExportExcel?: () => void;
}

export function SummaryRow({
  orders = [],
  selectedDate,
  refreshKey,
  onOpenRevenueModal,
  onExportExcel,
}: SummaryRowProps) {
  // Compute metrics for the selected day from orders
  const dayOrdersCount = orders.length;
  const dayRevenue = orders.reduce((s, o) => s + (o.amount || 0), 0);
  const completedOrders = orders.filter((o) => o.status === "COMPLETE");
  const completedRevenue = completedOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const draftOrders = orders.filter((o) => o.status === "DRAFT");

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {/* 1. Day Revenue with clickable breakdown trigger */}
      <div
        onClick={onOpenRevenueModal}
        className={cn(
          "group flex items-center justify-between rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card px-3.5 py-2.5 shadow-2xs transition-all",
          onOpenRevenueModal ? "cursor-pointer hover:border-emerald-500 hover:shadow-xs active:scale-[0.99]" : ""
        )}
        title="Click to view detailed item-wise day revenue breakdown"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-white shadow-2xs shrink-0">
            <IndianRupee className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base sm:text-lg font-extrabold tracking-tight text-foreground">
              {formatINR(dayRevenue)}
            </div>
            <div className="truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
              <span>Day Revenue</span>
              <ChevronRight className="h-3 w-3 opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Total Orders on Date */}
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-2xs">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
          <ListChecks className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-base sm:text-lg font-bold leading-tight text-foreground">
            {dayOrdersCount}
          </div>
          <div className="truncate text-[11px] text-muted-foreground font-medium">
            Total Orders
          </div>
        </div>
      </div>

      {/* 3. Completed Orders */}
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-2xs">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-base sm:text-lg font-bold leading-tight text-foreground">
            {completedOrders.length}
          </div>
          <div className="truncate text-[11px] text-muted-foreground font-medium">
            Completed ({formatINR(completedRevenue)})
          </div>
        </div>
      </div>

      {/* 4. Pending / Drafts */}
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-2xs">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
          <FileClock className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-base sm:text-lg font-bold leading-tight text-foreground">
            {draftOrders.length}
          </div>
          <div className="truncate text-[11px] text-muted-foreground font-medium">
            Drafts / Pending
          </div>
        </div>
      </div>
    </div>
  );
}
