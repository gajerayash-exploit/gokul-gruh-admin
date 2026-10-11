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
} from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import { api } from "@/lib/api/client";
import type { OrderDTO } from "@/types";
import type { EditableField } from "@/components/notebook/use-autosave";
import { todayISODate, formatDisplayDate, weekdayFromISO } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconTooltip } from "@/components/ui/tooltip";
import { NotebookRow } from "@/components/notebook/notebook-row";
import { BulkPasteDialog } from "@/components/notebook/bulk-paste-dialog";
import { PreviewPanel } from "@/components/orders/preview-panel";
import { SummaryRow } from "@/components/notebook/summary-row";
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
  const [bulkOpen, setBulkOpen] = React.useState(false);
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
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not load records",
        description: e instanceof Error ? e.message : "Please retry.",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, search, sortBy, sortDir]);

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

  const addEntry = React.useCallback(async () => {
    setAdding(true);
    try {
      const { order } = await api.createDraft(selectedDate);
      setOrders((prev) => [...prev, order]);
      setFocusTarget({ id: order.id, field: "fullName" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not add row",
        description: e instanceof Error ? e.message : "Please retry.",
      });
    } finally {
      setAdding(false);
    }
  }, [selectedDate]);

  const handleSaved = React.useCallback((updated: OrderDTO) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }, []);
  const handleDeleted = React.useCallback((id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
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

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-primary">
          <BookOpen className="h-5 w-5" />
          <h1 className="text-xl font-semibold text-brand-navy dark:text-foreground">
            Customer Order Register
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDisplayDate(selectedDate)} · {day}
          {isToday && <span className="ml-2 text-primary">· Today</span>}
          {" · "}
          {orders.length} record{orders.length === 1 ? "" : "s"} on this date
        </p>
      </div>

      <SummaryRow refreshKey={`${refreshKey}:${orders.length}`} />

      {/* Toolbar */}
      <div className="mb-3 mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-input bg-card px-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              max={todayISODate()}
              onChange={(e) => setSelectedDate(e.target.value || todayISODate())}
              className="bg-transparent py-1.5 text-sm outline-none"
              aria-label="Select register date"
            />
          </div>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(todayISODate())}>
              Jump to today
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
              placeholder="Search this date…  (Ctrl/⌘+K)"
              className="w-56 pl-8"
              aria-label="Search records"
            />
          </div>
          <IconTooltip label="Paste multiple records">
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <ClipboardPaste className="h-4 w-4" />
              <span className="hidden sm:inline">Paste</span>
            </Button>
          </IconTooltip>
          <Button onClick={addEntry} disabled={adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add New Entry
          </Button>
        </div>
      </div>

      {/* Register */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {/* Desktop header */}
        <div className="hidden lg:grid grid-cols-[92px_84px_1.3fr_120px_1.4fr_0.9fr_50px_86px_96px_108px_100px] border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <HeaderCell label="Date" onClick={() => toggleSort("businessDate")} active={sortBy === "businessDate"} dir={sortDir} />
          <div className="px-2 py-2.5">Day</div>
          <HeaderCell label="Full Name" onClick={() => toggleSort("fullName")} active={sortBy === "fullName"} dir={sortDir} />
          <div className="px-2 py-2.5">Phone</div>
          <div className="px-2 py-2.5">Address</div>
          <div className="px-2 py-2.5">Order Type</div>
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
            <EmptyState onAdd={addEntry} search={search} />
          ) : (
            orders.map((o, i) => (
              <NotebookRow
                key={o.id}
                order={o}
                settings={settings}
                index={i}
                focusField={focusTarget?.id === o.id ? focusTarget.field : null}
                onFocused={clearFocus}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                onPreview={openPreview}
                onRequestNextRow={addEntry}
              />
            ))
          )}
        </div>

        {/* Add row footer (desktop) */}
        {!loading && orders.length > 0 && (
          <button
            onClick={addEntry}
            className="hidden lg:flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-muted-foreground hover:bg-brand-soft/40 hover:text-primary"
          >
            <Plus className="h-4 w-4" /> Add new entry (or press Enter on the last field)
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
      <PreviewPanel
        order={previewOrder}
        settings={settings}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
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
