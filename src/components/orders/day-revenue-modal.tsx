"use client";

import * as React from "react";
import {
  IndianRupee,
  FileSpreadsheet,
  TrendingUp,
  CheckCircle2,
  Clock,
  Package,
  Layers,
  ShoppingBag,
  Download,
  Share2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OrderDTO } from "@/types";
import { formatINR, cn } from "@/lib/utils";
import { formatDisplayDate, weekdayFromISO } from "@/lib/dates";
import { exportDayOrdersToExcel } from "@/lib/export/excel";
import { toast } from "@/components/ui/use-toast";
import { GOKUL_ITEMS } from "@/components/orders/items-scroll-list";

export interface DayRevenueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderDTO[];
  dateISO: string;
  businessName?: string;
}

export function DayRevenueModal({
  open,
  onOpenChange,
  orders,
  dateISO,
  businessName = "Gokul Gruh Udhyog",
}: DayRevenueModalProps) {
  const [exporting, setExporting] = React.useState(false);

  const displayDate = formatDisplayDate(dateISO);
  const weekday = weekdayFromISO(dateISO);

  // Compute Revenue and order metrics
  const totalRevenue = orders.reduce((s, o) => s + (o.amount || 0), 0);
  const completedOrders = orders.filter((o) => o.status === "COMPLETE");
  const completedRevenue = completedOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const draftOrders = orders.filter((o) => o.status === "DRAFT");
  const draftRevenue = draftOrders.reduce((s, o) => s + (o.amount || 0), 0);
  const totalQty = orders.reduce((s, o) => s + (o.quantity || 0), 0);
  const aov = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

  // Aggregate item-wise sales
  const itemMap = new Map<
    string,
    { name: string; gujarati?: string; totalQty: number; totalRevenue: number; orderCount: number }
  >();

  for (const o of orders) {
    if (o.items && o.items.length > 0) {
      for (const it of o.items) {
        const key = it.itemName.toLowerCase().trim();
        const existing = itemMap.get(key);
        const itemDef = GOKUL_ITEMS.find((gi) => gi.name.toLowerCase() === key);
        if (existing) {
          existing.totalQty += it.quantity;
          existing.totalRevenue += it.amount;
          existing.orderCount += 1;
        } else {
          itemMap.set(key, {
            name: it.itemName,
            gujarati: itemDef?.gujarati,
            totalQty: it.quantity,
            totalRevenue: it.amount,
            orderCount: 1,
          });
        }
      }
    } else if (o.orderType) {
      // Single item fallback
      const key = o.orderType.toLowerCase().trim();
      const existing = itemMap.get(key);
      const itemDef = GOKUL_ITEMS.find((gi) => gi.name.toLowerCase() === key);
      if (existing) {
        existing.totalQty += o.quantity;
        existing.totalRevenue += o.amount;
        existing.orderCount += 1;
      } else {
        itemMap.set(key, {
          name: o.orderType,
          gujarati: itemDef?.gujarati,
          totalQty: o.quantity,
          totalRevenue: o.amount,
          orderCount: 1,
        });
      }
    }
  }

  const itemStats = Array.from(itemMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

  async function handleExport() {
    setExporting(true);
    try {
      await exportDayOrdersToExcel(orders, dateISO, businessName);
      toast({
        variant: "success",
        title: "Excel File Ready",
        description: `Exported ${orders.length} orders for ${displayDate}.`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not generate Excel file.",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xl p-0 gap-0 overflow-hidden sm:rounded-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-primary/5 border-b border-border px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-xs">
                <IndianRupee className="h-5 w-5 stroke-[2.5]" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>Day Revenue & Collection</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {displayDate} ({weekday}) · {orders.length} total orders
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || orders.length === 0}
              className="gap-1.5 h-8 text-xs font-semibold border-emerald-600/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </Button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Main Total Revenue Big Card */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total Day Collection / Revenue
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                    {formatINR(totalRevenue)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="bg-background text-foreground border-border text-xs px-2.5 py-1">
                  {orders.length} order{orders.length === 1 ? "" : "s"}
                </Badge>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Avg order: <span className="font-semibold text-foreground">{formatINR(aov)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub Stat Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* Completed */}
            <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Complete</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {formatINR(completedRevenue)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {completedOrders.length} orders finalized
              </div>
            </div>

            {/* Drafts */}
            <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Draft / Unpaid</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {formatINR(draftRevenue)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {draftOrders.length} pending orders
              </div>
            </div>

            {/* Total Quantity */}
            <div className="col-span-2 sm:col-span-1 rounded-xl border border-border bg-card p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold mb-1">
                <Package className="h-3.5 w-3.5" />
                <span>Volume Sold</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {totalQty} <span className="text-xs font-normal text-muted-foreground">units/kg</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Across all customers
              </div>
            </div>
          </div>

          {/* Item-wise Revenue Breakdown */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Item-Wise Revenue Breakdown
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {itemStats.length} distinct item{itemStats.length === 1 ? "" : "s"}
              </span>
            </div>

            {itemStats.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No item sales recorded for this date yet.
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {itemStats.map((it) => {
                  const percent = totalRevenue > 0 ? Math.round((it.totalRevenue / totalRevenue) * 100) : 0;
                  return (
                    <div key={it.name} className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-foreground truncate">{it.name}</span>
                          {it.gujarati && (
                            <span className="text-xs text-muted-foreground">({it.gujarati})</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {it.totalQty} total qty · in {it.orderCount} order{it.orderCount === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <div className="text-sm font-extrabold text-foreground tabular-nums">
                          {formatINR(it.totalRevenue)}
                        </div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          {percent}% of day
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-card p-3 sm:px-6 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || orders.length === 0}
            className="flex-1 gap-1.5 font-bold text-xs border-emerald-600/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Day Excel (.xlsx)</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
