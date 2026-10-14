"use client";

import * as React from "react";
import {
  Plus,
  Search,
  ClipboardPaste,
  CalendarDays,
  BookOpen,
  Loader2,
  ArrowUpDown,
  ShoppingBag,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  IndianRupee,
} from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import { api } from "@/lib/api/client";
import type { OrderDTO } from "@/types";
import type { EditableField } from "@/components/notebook/use-autosave";
import { todayISODate, tomorrowISODate, addDaysISO, formatDisplayDate, weekdayFromISO } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconTooltip } from "@/components/ui/tooltip";
import { NotebookRow } from "@/components/notebook/notebook-row";
import { BulkPasteDialog } from "@/components/notebook/bulk-paste-dialog";
import { MobileQuickPaste } from "@/components/orders/mobile-quick-paste";
import { DayRevenueModal } from "@/components/orders/day-revenue-modal";
import { exportDayOrdersToExcel } from "@/lib/export/excel";
import { PreviewPanel } from "@/components/orders/preview-panel";
import { SummaryRow } from "@/components/notebook/summary-row";
import { ItemsScrollList, type ItemDefinition } from "@/components/orders/items-scroll-list";
import { DayBadge } from "@/components/ui/day-badge";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type SortBy = "businessDate" | "fullName" | "docketNumber" | "updatedAt";

// __NB_BODY__
export function Notebook() {
  const { settings } = useApp();
  const [selectedDate, setSelectedDate] = React.useState(() => todayISODate());
  const [orders, setOrders] = React.useState<OrderDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortBy>("updatedAt");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [focusTarget, setFocusTarget] = React.useState<{ id: string; field: EditableField } | null>(null);
  const [activeOrderId, setActiveOrderId] = React.useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [quickPasteOpen, setQuickPasteOpen] = React.useState(false);
  const [revenueModalOpen, setRevenueModalOpen] = React.useState(false);
  const [exportingExcel, setExportingExcel] = React.useState(false);
  const [previewOrder, setPreviewOrder] = React.useState<OrderDTO | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listOrders({
        dateISO: selectedDate,
        search: search.trim() || undefined,
        sortBy,
        sortDir,
        pageSize: 200,
      });
      setOrders(res.orders);
      if (res.orders.length > 0 && !activeOrderId) {
        setActiveOrderId(res.orders[0].id);
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not load records",
        description: e instanceof Error ? e.message : "Please retry.",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, search, sortBy, sortDir, activeOrderId]);

  // Debounced reload when inputs change.
  React.useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search, refreshKey]);

  // Ctrl/Cmd+K focuses search.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addEntry = React.useCallback(async (initialItemName?: string) => {
    setAdding(true);
    try {
      const { order } = await api.createDraft(selectedDate, initialItemName);
      setOrders((prev) => [order, ...prev]);
      setActiveOrderId(order.id);
      setFocusTarget({ id: order.id, field: "fullName" });
      toast({
        variant: "success",
        title: initialItemName ? `Order created with ${initialItemName}` : "New order ready",
        description: "Enter customer details and add items.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not add order",
        description: e instanceof Error ? e.message : "Please retry.",
      });
    } finally {
      setAdding(false);
    }
  }, [selectedDate]);

  const handleSelectItem = React.useCallback(
    async (item: ItemDefinition) => {
      const target = orders.find((o) => o.id === activeOrderId) || orders[0];
      if (!target) {
        // If no orders exist on this date yet, create a new order with this item
        await addEntry(item.name);
        return;
      }

      try {
        const res = await api.addOrderItem(target.id, {
          itemName: item.name,
          quantity: 1,
          unitPrice: item.defaultPrice || 0,
        });
        setOrders((prev) => prev.map((o) => (o.id === target.id ? res.order : o)));
        setActiveOrderId(target.id);
        toast({
          variant: "success",
          title: `Added ${item.name} (${item.gujarati})`,
          description: `Added to ${target.fullName || "active order"}`,
        });
      } catch (e) {
        toast({
          variant: "destructive",
          title: "Could not add item",
          description: e instanceof Error ? e.message : "Please retry.",
        });
      }
    },
    [orders, activeOrderId, addEntry]
  );

  const handleSaved = React.useCallback((updated: OrderDTO) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }, []);
  const handleDeleted = React.useCallback((id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    setActiveOrderId((cur) => (cur === id ? null : cur));
  }, []);
  const clearFocus = React.useCallback(() => setFocusTarget(null), []);
  const openPreview = React.useCallback((o: OrderDTO) => {
    setPreviewOrder(o);
    setPreviewOpen(true);
  }, []);

  function toggleSort(col: SortBy) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  const day = weekdayFromISO(selectedDate);
  const isToday = selectedDate === todayISODate();
  const isTomorrow = selectedDate === tomorrowISODate();
  const isFuture = selectedDate > tomorrowISODate();
  const activeOrder = orders.find((o) => o.id === activeOrderId) || orders[0] || null;

  const handleOrderCreatedViaPaste = React.useCallback((newOrder: OrderDTO) => {
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === newOrder.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newOrder;
        return next;
      }
      return [newOrder, ...prev];
    });
    setActiveOrderId(newOrder.id);
  }, []);

  const handleExportExcel = React.useCallback(async () => {
    if (orders.length === 0) {
      toast({
        variant: "warning",
        title: "No orders to export",
        description: "Add or load orders on this date before exporting.",
      });
      return;
    }
    setExportingExcel(true);
    try {
      await exportDayOrdersToExcel(orders, selectedDate, settings.businessName);
      toast({
        variant: "success",
        title: "Excel Exported!",
        description: `Exported ${orders.length} order details for ${formatDisplayDate(selectedDate)}.`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not export Excel file.",
      });
    } finally {
      setExportingExcel(false);
    }
  }, [orders, selectedDate, settings.businessName]);

  const dayTotalRevenue = orders.reduce((s, o) => s + (o.amount || 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1700px] pb-24 lg:pb-6">
      {/* Header */}
      <div className="mb-3 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-primary">
          <BookOpen className="h-5 w-5" />
          <h1 className="text-xl font-semibold text-brand-navy dark:text-foreground">
            Customer Order Register
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-brand-navy dark:text-foreground">{formatDisplayDate(selectedDate)}</span>
          <DayBadge day={day} variant="header" />
          {isToday && (
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              Today
            </span>
          )}
          {isTomorrow && (
            <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              Tomorrow
            </span>
          )}
          {isFuture && (
            <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/30">
              Upcoming Date
            </span>
          )}
          <span>
            · {orders.length} record{orders.length === 1 ? "" : "s"} on this date
          </span>
        </div>
      </div>

      <SummaryRow
        orders={orders}
        selectedDate={selectedDate}
        refreshKey={`${refreshKey}:${orders.length}`}
        onOpenRevenueModal={() => setRevenueModalOpen(true)}
      />

      {/* Toolbar with Take / Add New Order button at very start */}
      <div className="mb-3 mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Prominent Button at very start */}
          <Button
            size="default"
            className="gap-2 font-semibold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => addEntry()}
            disabled={adding}
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 stroke-[2.5]" />}
            Take / Add New Order
          </Button>

          {/* Quick Paste Button for Mobile & Desktop */}
          <Button
            variant="outline"
            size="default"
            onClick={() => setQuickPasteOpen(true)}
            className="gap-1.5 font-semibold border-primary/40 text-primary bg-brand-soft/30 hover:bg-brand-soft"
          >
            <ClipboardPaste className="h-4 w-4" />
            <span>Paste Customer Details</span>
          </Button>

          {/* Date Picker with Prev / Next Steppers */}
          <div className="flex items-center gap-0.5 rounded-md border border-input bg-card px-1 py-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setSelectedDate(addDaysISO(selectedDate, -1))}
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <CalendarDays className="h-4 w-4 text-muted-foreground ml-0.5" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || todayISODate())}
              className="bg-transparent px-1 py-1 text-sm outline-none font-medium text-foreground cursor-pointer"
              aria-label="Select register date"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(addDaysISO(selectedDate, 1))}
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Date Shortcut Buttons: Jump to Today / Tomorrow */}
          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(todayISODate())}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Jump to today
            </Button>
          )}
          {!isTomorrow && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(tomorrowISODate())}
              className="text-xs font-semibold border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
            >
              Tomorrow ❯
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search (Ctrl/⌘+K)…"
              className="w-52 pl-8"
              aria-label="Search records"
            />
          </div>
          <IconTooltip label="Export day orders to Excel (.xlsx)">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={exportingExcel || orders.length === 0}
              className="gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
            >
              {exportingExcel ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              )}
              <span>Export Excel</span>
            </Button>
          </IconTooltip>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevenueModalOpen(true)}
            className="gap-1.5 font-semibold text-foreground border-border hover:bg-secondary"
            title="View complete day revenue and item collections"
          >
            <IndianRupee className="h-4 w-4 text-emerald-600" />
            <span>Revenue</span>
          </Button>

          <IconTooltip label="Paste multiple records">
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
              <ClipboardPaste className="h-4 w-4" />
              <span className="hidden sm:inline">Bulk Paste</span>
            </Button>
          </IconTooltip>
        </div>
      </div>

      {/* Scrollable list of items */}
      <div className="mb-3">
        <ItemsScrollList
          onSelectItem={handleSelectItem}
          selectedOrderName={activeOrder?.fullName || (orders[0] ? orders[0].fullName || "Active Order" : undefined)}
          selectedOrderDocket={activeOrder?.docketNumber || orders[0]?.docketNumber}
        />
      </div>

      {/* Register */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {/* Desktop header */}
        <div className="hidden lg:grid grid-cols-[88px_74px_1.2fr_112px_1.2fr_1.8fr_48px_78px_92px_100px_96px] border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <HeaderCell label="Date" onClick={() => toggleSort("businessDate")} active={sortBy === "businessDate"} dir={sortDir} />
          <div className="px-2 py-2.5">Day</div>
          <HeaderCell label="Full Name" onClick={() => toggleSort("fullName")} active={sortBy === "fullName"} dir={sortDir} />
          <div className="px-2 py-2.5">Phone</div>
          <div className="px-2 py-2.5">Address</div>
          <div className="px-2 py-2.5 font-bold text-primary">Items / Sub-Entries</div>
          <div className="px-2 py-2.5 text-right">Qty</div>
          <div className="px-2 py-2.5 text-right">Rate ₹</div>
          <div className="px-2 py-2.5 text-right">Amount</div>
          <HeaderCell label="Docket" onClick={() => toggleSort("docketNumber")} active={sortBy === "docketNumber"} dir={sortDir} />
          <div className="px-2 py-2.5">Status</div>
        </div>

        <div className="divide-y divide-transparent lg:divide-y-0 flex flex-col gap-3 p-3 lg:gap-0 lg:p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading records…
            </div>
          ) : orders.length === 0 ? (
            <EmptyState onAdd={() => addEntry()} search={search} />
          ) : (
            orders.map((o, i) => (
              <NotebookRow
                key={o.id}
                order={o}
                settings={settings}
                index={i}
                isActive={activeOrderId === o.id}
                onSelect={() => setActiveOrderId(o.id)}
                focusField={focusTarget?.id === o.id ? focusTarget.field : null}
                onFocused={clearFocus}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                onPreview={openPreview}
                onRequestNextRow={() => addEntry()}
              />
            ))
          )}
        </div>

        {/* Add row footer (desktop) */}
        {!loading && orders.length > 0 && (
          <button
            onClick={() => addEntry()}
            className="hidden lg:flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-muted-foreground hover:bg-brand-soft/40 hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" /> Take / Add another new order
          </button>
        )}
      </div>

      {/* Order-type suggestions */}
      <datalist id="ggu-order-types">
        {settings.orderTypes.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <BulkPasteDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        defaultDateISO={selectedDate}
        onImported={() => setRefreshKey((k) => k + 1)}
      />
      <MobileQuickPaste
        open={quickPasteOpen}
        onOpenChange={setQuickPasteOpen}
        selectedDateISO={selectedDate}
        onOrderCreatedOrUpdated={handleOrderCreatedViaPaste}
      />
      <DayRevenueModal
        open={revenueModalOpen}
        onOpenChange={setRevenueModalOpen}
        orders={orders}
        dateISO={selectedDate}
        businessName={settings.businessName}
      />
      <PreviewPanel
        order={previewOrder}
        settings={settings}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

      {/* Sticky Bottom Action Bar on Mobile for quick access */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col gap-1.5 border-t border-border bg-card/95 px-3 py-2 backdrop-blur-md shadow-lg lg:hidden">
        {/* Mobile Quick Date & Revenue Bar */}
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRevenueModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 active:scale-95 transition-transform"
              title="Click to view complete revenue breakdown"
            >
              <IndianRupee className="h-3 w-3 stroke-[3]" />
              <span>₹{dayTotalRevenue.toLocaleString("en-IN")}</span>
            </button>
            <span className="text-[11px] text-muted-foreground font-medium">
              {formatDisplayDate(selectedDate).slice(0, 5)} ({weekdayFromISO(selectedDate).slice(0, 3)})
            </span>
            {isTomorrow && (
              <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                Tomorrow
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingExcel || orders.length === 0}
              className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 underline disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3 w-3" />
              <span>Excel</span>
            </button>
            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayISODate())}
                className="text-[11px] font-semibold text-primary underline"
              >
                Today
              </button>
            )}
            {!isTomorrow && (
              <button
                type="button"
                onClick={() => setSelectedDate(tomorrowISODate())}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 underline"
              >
                Tomorrow ❯
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="flex-1 gap-2 font-bold bg-primary text-primary-foreground shadow-sm h-11 text-sm rounded-xl"
            onClick={() => addEntry()}
            disabled={adding}
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 stroke-[3]" />}
            Take Order
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-1.5 font-bold border-primary/40 bg-brand-soft/40 text-primary hover:bg-brand-soft h-11 text-sm rounded-xl"
            onClick={() => setQuickPasteOpen(true)}
          >
            <ClipboardPaste className="h-4 w-4" />
            Paste Details
          </Button>
        </div>
      </div>
    </div>
  );
}

function HeaderCell({
  label,
  onClick,
  active,
  dir,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-2.5 text-left uppercase hover:text-primary",
        active && "text-primary"
      )}
    >
      {label}
      <ArrowUpDown className={cn("h-3 w-3", active && dir === "desc" && "rotate-180")} />
    </button>
  );
}

function EmptyState({ onAdd, search }: { onAdd: () => void; search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-primary">
        <BookOpen className="h-6 w-6" />
      </div>
      {search ? (
        <p className="text-sm text-muted-foreground">
          No records match “{search}” on this date.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            No orders recorded for this date yet.
          </p>
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4" /> Add the first entry
          </Button>
        </>
      )}
    </div>
  );
}
