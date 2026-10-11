"use client";

import * as React from "react";
import {
  Search,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Loader2,
  History as HistoryIcon,
  X,
} from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import { api } from "@/lib/api/client";
import type { OrderDTO } from "@/types";
import { formatDisplayDate } from "@/lib/dates";
import { formatPhoneForDisplay, normalizeIndianPhone } from "@/lib/validation/order";
import { cn, formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { IconTooltip } from "@/components/ui/tooltip";
import { PreviewPanel } from "@/components/orders/preview-panel";
import { OrderEditDialog } from "@/components/orders/order-edit-dialog";

type SortBy = "businessDate" | "fullName" | "docketNumber" | "updatedAt";

// __HIST_BODY__
const PAGE_SIZE = 25;

export function HistoryView() {
  const { settings } = useApp();
  const [search, setSearch] = React.useState("");
  const [exactDate, setExactDate] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [status, setStatus] = React.useState<"" | "DRAFT" | "COMPLETE">("");
  const [sortBy, setSortBy] = React.useState<SortBy>("businessDate");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);

  const [orders, setOrders] = React.useState<OrderDTO[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const [preview, setPreview] = React.useState<OrderDTO | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<OrderDTO | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listOrders({
        search: search.trim() || undefined,
        dateISO: exactDate || undefined,
        fromISO: !exactDate && fromDate ? fromDate : undefined,
        toISO: !exactDate && toDate ? toDate : undefined,
        status: status || undefined,
        sortBy,
        sortDir,
        page,
        pageSize: PAGE_SIZE,
      });
      setOrders(res.orders);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [search, exactDate, fromDate, toDate, status, sortBy, sortDir, page]);

  React.useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Reset to first page when filters change.
  React.useEffect(() => {
    setPage(1);
  }, [search, exactDate, fromDate, toDate, status, sortBy, sortDir]);

  function toggleSort(col: SortBy) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir(col === "fullName" ? "asc" : "desc");
    }
  }

  function clearFilters() {
    setSearch("");
    setExactDate("");
    setFromDate("");
    setToDate("");
    setStatus("");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = search || exactDate || fromDate || toDate || status;

  function patchLocal(o: OrderDTO) {
    setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)));
    if (preview?.id === o.id) setPreview(o);
  }
  function removeLocal(id: string) {
    setOrders((prev) => prev.filter((x) => x.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-4 flex items-center gap-2 text-primary">
        <HistoryIcon className="h-5 w-5" />
        <h1 className="text-xl font-semibold text-brand-navy dark:text-foreground">Order History</h1>
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="h-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="h-search"
              className="pl-8"
              placeholder="Name, phone, docket, type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="h-exact">Exact date</Label>
          <Input id="h-exact" type="date" value={exactDate} onChange={(e) => setExactDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="h-from">From</Label>
          <Input id="h-from" type="date" value={fromDate} disabled={!!exactDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="h-to">To</Label>
          <Input id="h-to" type="date" value={toDate} disabled={!!exactDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <div className="space-y-1">
            <Label htmlFor="h-status">Status</Label>
            <select
              id="h-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "" | "DRAFT" | "COMPLETE")}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="">All</option>
              <option value="COMPLETE">Complete</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" /> Clear filters
            </Button>
          )}
          <div className="ml-auto self-center text-sm text-muted-foreground">
            {total} record{total === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="hidden md:grid grid-cols-[108px_76px_1.3fr_128px_0.9fr_104px_104px_132px] border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <SortHead label="Date" col="businessDate" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
          <div className="px-3 py-2.5">Day</div>
          <SortHead label="Name" col="fullName" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
          <div className="px-3 py-2.5">Phone</div>
          <div className="px-3 py-2.5">Order Type</div>
          <div className="px-3 py-2.5 text-right">Amount</div>
          <SortHead label="Docket" col="docketNumber" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
          <div className="px-3 py-2.5 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No records found{hasFilters ? " for these filters." : "."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {orders.map((o) => (
              <li key={o.id} className="md:grid md:grid-cols-[108px_76px_1.3fr_128px_0.9fr_104px_104px_132px] md:items-center">
                {/* Desktop cells */}
                <div className="hidden md:block px-3 py-2.5 text-sm">{formatDisplayDate(o.businessDate)}</div>
                <div className="hidden md:block px-3 py-2.5 text-xs text-muted-foreground">{o.weekday}</div>
                <div className="hidden md:block px-3 py-2.5 text-sm font-medium text-brand-navy dark:text-foreground">
                  {o.fullName || <span className="text-muted-foreground">—</span>}
                </div>
                <div className="hidden md:block px-3 py-2.5 text-sm">
                  {o.phoneNumber ? phoneDisp(o.phoneNumber) : "—"}
                </div>
                <div className="hidden md:block px-3 py-2.5 text-sm">{o.orderType || "—"}</div>
                <div className="hidden md:block px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
                  {o.amount > 0 ? formatINR(o.amount) : "—"}
                </div>
                <div className="hidden md:block px-3 py-2.5 text-sm font-semibold">{o.docketNumber || "—"}</div>
                <div className="hidden md:flex items-center justify-end gap-1 px-3 py-2.5">
                  <RowActions o={o} onPreview={() => { setPreview(o); setPreviewOpen(true); }} onEdit={() => { setEdit(o); setEditOpen(true); }} />
                </div>

                {/* Mobile card */}
                <div className="md:hidden p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-brand-navy dark:text-foreground">{o.fullName || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDisplayDate(o.businessDate)} · {o.weekday} · Docket {o.docketNumber || "—"}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {o.phoneNumber ? phoneDisp(o.phoneNumber) : "—"} · {o.orderType || "—"}
                        {o.amount > 0 ? ` · ${formatINR(o.amount)}` : ""}
                      </div>
                    </div>
                    {o.status === "COMPLETE" ? (
                      <Badge variant="success">Complete</Badge>
                    ) : (
                      <Badge variant="warning">Draft</Badge>
                    )}
                  </div>
                  <div className="mt-2 flex gap-1">
                    <RowActions o={o} onPreview={() => { setPreview(o); setPreviewOpen(true); }} onEdit={() => { setEdit(o); setEditOpen(true); }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {!loading && orders.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <datalist id="ggu-order-types-edit">
        {settings.orderTypes.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <PreviewPanel
        order={preview}
        settings={settings}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onEdit={(o) => {
          setPreviewOpen(false);
          setEdit(o);
          setEditOpen(true);
        }}
      />
      <OrderEditDialog
        order={edit}
        settings={settings}
        open={editOpen}
        onOpenChange={setEditOpen}
        onChanged={patchLocal}
        onDeleted={removeLocal}
      />
    </div>
  );
}

function phoneDisp(raw: string) {
  const n = normalizeIndianPhone(raw);
  return n ? formatPhoneForDisplay(n) : raw;
}

function RowActions({
  o,
  onPreview,
  onEdit,
}: {
  o: OrderDTO;
  onPreview: () => void;
  onEdit: () => void;
}) {
  void o;
  return (
    <>
      <IconTooltip label="Preview / print / download">
        <Button size="icon-sm" variant="ghost" onClick={onPreview} aria-label="Preview order">
          <Eye className="h-4 w-4" />
        </Button>
      </IconTooltip>
      <IconTooltip label="Edit">
        <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Edit order">
          <Pencil className="h-4 w-4" />
        </Button>
      </IconTooltip>
    </>
  );
}

function SortHead({
  label,
  col,
  sortBy,
  sortDir,
  onClick,
}: {
  label: string;
  col: SortBy;
  sortBy: SortBy;
  sortDir: "asc" | "desc";
  onClick: (c: SortBy) => void;
}) {
  const active = sortBy === col;
  return (
    <button
      onClick={() => onClick(col)}
      className={cn("px-3 py-2.5 text-left uppercase hover:text-primary", active && "text-primary")}
    >
      {label} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </button>
  );
}
