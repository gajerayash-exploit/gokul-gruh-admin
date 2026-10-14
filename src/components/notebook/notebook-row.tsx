"use client";

import * as React from "react";
import {
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  Plus,
  ChevronDown,
  ChevronUp,
  Layers,
  ClipboardPaste,
  Camera,
} from "lucide-react";
import type { OrderDTO, BusinessSettingsDTO } from "@/types";
import { cn, formatINR } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { useAutosave, type EditableField } from "@/components/notebook/use-autosave";
import { SaveStatus } from "@/components/notebook/save-status";
import { formatDisplayDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { OrderItemsEditor } from "@/components/orders/order-items-editor";
import { DayBadge } from "@/components/ui/day-badge";
import { MobileQuickPaste } from "@/components/orders/mobile-quick-paste";
import { DocketScannerDialog } from "@/components/orders/docket-scanner-dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const NAV_ORDER: EditableField[] = [
  "fullName",
  "phoneNumber",
  "orderType",
  "quantity",
  "unitPrice",
  "docketNumber",
];

export interface NotebookRowProps {
  order: OrderDTO;
  settings: BusinessSettingsDTO;
  index: number;
  isActive?: boolean;
  onSelect?: () => void;
  focusField?: EditableField | null;
  onFocused?: () => void;
  onSaved?: (o: OrderDTO) => void;
  onDeleted?: (id: string) => void;
  onPreview?: (o: OrderDTO) => void;
  onRequestNextRow?: () => void;
}

function NotebookRowInner({
  order,
  settings,
  index,
  isActive = false,
  onSelect,
  focusField,
  onFocused,
  onSaved,
  onDeleted,
  onPreview,
  onRequestNextRow,
}: NotebookRowProps) {
  const save = useAutosave(order, {
    onSaved,
    onConflict: () => {
      toast({
        variant: "warning",
        title: "Record changed elsewhere",
        description: "This order was modified in another session. Latest changes shown.",
      });
    },
  });
  const { fields, setField, saveState, lastSavedAt, retry, weekday, phoneValid, amount } = save;

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [duplicates, setDuplicates] = React.useState<OrderDTO[]>([]);
  const [expanded, setExpanded] = React.useState(false);
  const [mobilePasteOpen, setMobilePasteOpen] = React.useState(false);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const dupTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const pasteToField = React.useCallback(async (field: EditableField) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setField(field, text.trim());
          toast({
            variant: "success",
            title: "Pasted",
            description: `Updated field with copied text.`,
          });
        }
      }
    } catch {
      toast({
        variant: "default",
        title: "Please paste manually",
        description: "Tap into the input and tap Paste.",
      });
    }
  }, [setField]);

  const hasItems = order.items && order.items.length > 0;
  const itemsTotalQty = hasItems ? order.items.reduce((s, it) => s + it.quantity, 0) : 0;
  const itemsTotalAmt = hasItems ? order.items.reduce((s, it) => s + it.amount, 0) : 0;

  // Focus a specific field when requested (new-row flow / keyboard nav).
  React.useEffect(() => {
    if (!focusField) return;
    const el = document.querySelector<HTMLElement>(
      `[data-cell="${order.id}:${focusField}"]`
    );
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          /* some input types disallow selection */
        }
      }
    }
    onFocused?.();
  }, [focusField, order.id, onFocused]);

  // Debounced duplicate-docket check.
  React.useEffect(() => {
    const docket = fields.docketNumber.trim();
    if (dupTimer.current) clearTimeout(dupTimer.current);
    if (!docket) {
      setDuplicates([]);
      return;
    }
    dupTimer.current = setTimeout(async () => {
      try {
        const { matches } = await api.checkDuplicates(docket, order.id);
        setDuplicates(matches);
      } catch {
        /* non-fatal */
      }
    }, 700);
    return () => {
      if (dupTimer.current) clearTimeout(dupTimer.current);
    };
  }, [fields.docketNumber, order.id]);

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    field: EditableField
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const i = NAV_ORDER.indexOf(field);
    if (i < NAV_ORDER.length - 1) {
      const next = NAV_ORDER[i + 1];
      document
        .querySelector<HTMLElement>(`[data-cell="${order.id}:${next}"]`)
        ?.focus();
    } else {
      // Last field -> request a new row below.
      onRequestNextRow?.();
    }
  }

  async function doDelete() {
    try {
      await api.deleteOrder(order.id);
      onDeleted?.(order.id);
      toast({ variant: "success", title: "Record deleted", description: "The order was removed from the register." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Could not delete the record.",
      });
    } finally {
      setConfirmDelete(false);
    }
  }

  const hasDuplicate = duplicates.length > 0;
  const complete = save.isComplete;

  const inputCls =
    "w-full bg-transparent px-2 py-1.5 text-base sm:text-sm outline-none focus:bg-brand-soft/60 dark:focus:bg-primary/10 rounded placeholder:text-muted-foreground/60";

  // Shared field renderers (used by both desktop grid and mobile card).
  const nameInput = (
    <input
      data-cell={`${order.id}:fullName`}
      className={inputCls}
      value={fields.fullName}
      placeholder="Full name"
      onChange={(e) => setField("fullName", e.target.value)}
      onKeyDown={(e) => handleKeyDown(e, "fullName")}
      aria-label="Full name"
    />
  );
  const phoneInput = (
    <input
      data-cell={`${order.id}:phoneNumber`}
      className={cn(inputCls, !phoneValid && "text-destructive")}
      value={fields.phoneNumber}
      placeholder="+91 …"
      inputMode="tel"
      onChange={(e) => setField("phoneNumber", e.target.value)}
      onKeyDown={(e) => handleKeyDown(e, "phoneNumber")}
      aria-label="Phone number"
      aria-invalid={!phoneValid}
    />
  );
  const addressInput = (
    <textarea
      data-cell={`${order.id}:address`}
      className={cn(inputCls, "resize-none leading-snug")}
      rows={1}
      value={fields.address}
      placeholder="Address"
      onChange={(e) => {
        setField("address", e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      aria-label="Address"
    />
  );
  const typeInput = hasItems ? (
    <div className="flex w-full items-center justify-between gap-1 px-1.5 py-1">
      <div className="flex flex-wrap items-center gap-1 overflow-hidden">
        {order.items.slice(0, 3).map((it) => (
          <span
            key={it.id}
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors",
              it.unitPrice
                ? "bg-brand-soft/80 text-primary"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
            )}
          >
            <span>{it.itemName}</span>
            {it.quantity > 1 && <span className="opacity-75">×{it.quantity}</span>}
            {it.unitPrice ? (
              <span className="opacity-70 text-[10px]">₹{it.unitPrice}</span>
            ) : (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">₹?</span>
            )}
          </span>
        ))}
        {order.items.length > 3 && (
          <span className="text-[10px] font-semibold text-muted-foreground">
            +{order.items.length - 3}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((prev) => !prev);
        }}
        className="shrink-0 rounded p-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        title={expanded ? "Hide items" : "Manage items"}
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
    </div>
  ) : (
    <div className="flex items-center w-full">
      <input
        data-cell={`${order.id}:orderType`}
        className={cn(inputCls, "flex-1")}
        value={fields.orderType}
        placeholder="Order type or add items…"
        list="ggu-order-types"
        onChange={(e) => setField("orderType", e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "orderType")}
        aria-label="Order type"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
        className="mr-1 text-muted-foreground hover:text-primary"
        title="Add sub-entries"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const docketInput = (
    <div className="flex items-center gap-1 w-full">
      <input
        data-cell={`${order.id}:docketNumber`}
        className={cn(inputCls, hasDuplicate && "text-warning-foreground")}
        value={fields.docketNumber}
        placeholder="Docket #"
        onChange={(e) => setField("docketNumber", e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "docketNumber")}
        aria-label="Docket number"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setScannerOpen(true);
        }}
        className="shrink-0 p-1 rounded text-muted-foreground hover:text-primary hover:bg-brand-soft/80 transition-colors"
        title="Scan docket barcode with camera"
        aria-label="Scan docket barcode"
      >
        <Camera className="h-3.5 w-3.5" />
      </button>
      {hasDuplicate && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="shrink-0 text-warning-foreground"
              aria-label={`Possible duplicate docket (${duplicates.length})`}
            >
              <AlertTriangle className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <p className="mb-2 text-xs font-medium text-warning-foreground">
              Possible duplicate docket number
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {duplicates.slice(0, 5).map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <span className="truncate">{d.fullName || "Unnamed"}</span>
                  <span className="shrink-0">{formatDisplayDate(d.businessDate)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              You can keep this entry — duplicates are allowed, just confirmed.
            </p>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );

  const hasMultipleItems = hasItems && order.items.length > 1;
  const hasMissingPrice = hasItems && order.items.some((it) => !it.unitPrice);

  const qtyInput = hasMultipleItems ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(true);
      }}
      className={cn(inputCls, "text-right tabular-nums font-semibold hover:text-primary cursor-pointer")}
      title="Total quantity across all items (click to view)"
    >
      {itemsTotalQty}
    </button>
  ) : (
    <input
      data-cell={`${order.id}:quantity`}
      className={cn(inputCls, "text-right tabular-nums")}
      value={fields.quantity}
      placeholder="0"
      inputMode="numeric"
      onChange={(e) => setField("quantity", e.target.value.replace(/[^\d]/g, ""))}
      onKeyDown={(e) => handleKeyDown(e, "quantity")}
      aria-label="Quantity"
    />
  );

  const rateInput = hasMultipleItems ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setExpanded((prev) => !prev);
      }}
      className={cn(
        inputCls,
        "text-right tabular-nums text-xs block truncate transition-colors text-right cursor-pointer",
        hasMissingPrice
          ? "font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded"
          : "text-muted-foreground hover:text-primary hover:bg-brand-soft/50 rounded"
      )}
      title="Multiple items — click to view and edit individual rates"
    >
      {hasMissingPrice ? "Rate ⚠" : "Multi ₹"}
    </button>
  ) : (
    <input
      data-cell={`${order.id}:unitPrice`}
      className={cn(
        inputCls,
        "text-right tabular-nums transition-colors",
        (!fields.unitPrice || parseFloat(fields.unitPrice) === 0)
          ? "border border-amber-400 bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 placeholder:text-amber-500 font-bold"
          : "focus:border-primary font-semibold"
      )}
      value={fields.unitPrice}
      placeholder="₹ Rate"
      inputMode="decimal"
      onChange={(e) =>
        setField("unitPrice", e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))
      }
      onKeyDown={(e) => handleKeyDown(e, "unitPrice")}
      aria-label="Unit price in rupees"
      title="Enter unit price in rupees (e.g. 60 or 80)"
    />
  );

  const amountToDisplay = hasItems ? itemsTotalAmt : amount;
  const amountCell = (
    <span className="w-full px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-brand-navy dark:text-foreground">
      {amountToDisplay > 0 ? formatINR(amountToDisplay) : <span className="text-muted-foreground/60">—</span>}
    </span>
  );

  const dateCell = (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        data-cell={`${order.id}:businessDate`}
        className="w-full bg-transparent px-1 py-1.5 text-xs outline-none focus:bg-brand-soft/60 dark:focus:bg-primary/10 rounded"
        value={fields.businessDate}
        onChange={(e) => setField("businessDate", e.target.value)}
        aria-label="Business date"
      />
    </div>
  );

  const actions = (
    <div className="flex items-center gap-0.5">
      <IconTooltip label="Preview / print">
        <Button size="icon-sm" variant="ghost" onClick={() => onPreview?.(order)} aria-label="Preview order">
          <Eye className="h-4 w-4" />
        </Button>
      </IconTooltip>
      <IconTooltip label="Delete record">
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete order"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </IconTooltip>
    </div>
  );

  // __BODY__
  const deleteDialog = (
    <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this order?</DialogTitle>
          <DialogDescription>
            This affects your stored business history. The record is moved to a
            recoverable deleted state (soft delete) and kept in the audit trail.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <div className="font-medium text-brand-navy dark:text-foreground">
            {fields.fullName || "Unnamed customer"}
          </div>
          <div className="text-muted-foreground">
            {formatDisplayDate(fields.businessDate)} · Docket{" "}
            {fields.docketNumber || "—"}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={doDelete}>
            <Trash2 className="h-4 w-4" />
            Delete record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {/* Desktop register row */}
      <div
        onClick={onSelect}
        className={cn(
          "hidden lg:grid grid-cols-[88px_74px_1.2fr_112px_1.2fr_1.8fr_48px_78px_92px_100px_96px] items-stretch border-b border-border transition-colors cursor-pointer",
          index % 2 === 1 && "bg-muted/30",
          isActive && "bg-brand-soft/40 dark:bg-primary/10 border-l-4 border-l-primary",
          "hover:bg-brand-soft/30 dark:hover:bg-primary/5"
        )}
      >
        <div className="flex items-center border-r border-border/70 px-1">{dateCell}</div>
        <div className="flex items-center justify-center border-r border-border/70 px-1.5">
          <DayBadge day={weekday} />
        </div>
        <div className="flex items-center border-r border-border/70">{nameInput}</div>
        <div className="flex items-center border-r border-border/70">{phoneInput}</div>
        <div className="flex items-center border-r border-border/70">{addressInput}</div>
        <div className="flex items-center border-r border-border/70">{typeInput}</div>
        <div className="flex items-center border-r border-border/70">{qtyInput}</div>
        <div className="flex items-center border-r border-border/70">{rateInput}</div>
        <div className="flex items-center border-r border-border/70">{amountCell}</div>
        <div className="flex items-center border-r border-border/70 px-1">{docketInput}</div>
        <div className="flex items-center justify-between gap-1 px-1.5">
          <SaveStatus state={saveState} lastSavedAt={lastSavedAt} onRetry={retry} compact />
          {actions}
        </div>
      </div>

      {/* Expandable sub-entries panel (desktop) */}
      {expanded && (
        <div className="hidden lg:block border-b border-border/80 bg-muted/20 px-6 py-3 pl-16 transition-all animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-brand-navy dark:text-foreground">
                Customer Sub-Entries for {fields.fullName || "Unnamed customer"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
              className="h-6 text-xs text-muted-foreground"
            >
              Hide items
            </Button>
          </div>
          <OrderItemsEditor
            order={order}
            onOrderUpdated={(updated) => {
              onSaved?.(updated);
            }}
          />
        </div>
      )}

      {/* Mobile card */}
      <div
        onClick={onSelect}
        className={cn(
          "lg:hidden rounded-xl border border-border bg-card p-3 shadow-sm",
          isActive && "ring-2 ring-primary/40 border-primary"
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">{formatDisplayDate(fields.businessDate)}</span>
            <DayBadge day={weekday} />
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setMobilePasteOpen(true);
              }}
              className="h-7 gap-1 px-2 text-xs font-semibold border-primary/40 bg-brand-soft/30 text-primary hover:bg-brand-soft"
              title="Paste WhatsApp / customer details directly into this card"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              <span>Paste Details</span>
            </Button>
            {complete ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Complete
              </Badge>
            ) : (
              <Badge variant="warning">Draft</Badge>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <LabeledField
            label="Full Name"
            onPaste={() => pasteToField("fullName")}
          >
            {nameInput}
          </LabeledField>
          <div className="grid grid-cols-2 gap-2">
            <LabeledField
              label="Phone"
              onPaste={() => pasteToField("phoneNumber")}
            >
              {phoneInput}
            </LabeledField>
            <LabeledField
              label="Docket"
              onScan={() => setScannerOpen(true)}
            >
              {docketInput}
            </LabeledField>
          </div>
          <LabeledField
            label="Address"
            onPaste={() => pasteToField("address")}
          >
            {addressInput}
          </LabeledField>
          <LabeledField label="Order Type">{typeInput}</LabeledField>
          <div className="grid grid-cols-3 gap-2">
            <LabeledField label="Qty">{qtyInput}</LabeledField>
            <LabeledField label="Rate (₹)">{rateInput}</LabeledField>
            <LabeledField label="Amount">{amountCell}</LabeledField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LabeledField label="Date">{dateCell}</LabeledField>
            <div className="flex flex-col justify-center rounded-lg border border-border bg-background/60 px-2 py-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Day
              </span>
              <div className="pt-0.5">
                <DayBadge day={weekday} />
              </div>
            </div>
          </div>
        </div>

        {/* Sub-entries editor on mobile */}
        <div className="mt-3 border-t border-border pt-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Customer Items ({order.items?.length || 0})
            </span>
          </div>
          <OrderItemsEditor
            order={order}
            onOrderUpdated={(updated) => {
              onSaved?.(updated);
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
          <SaveStatus state={saveState} lastSavedAt={lastSavedAt} onRetry={retry} />
          {actions}
        </div>
      </div>

      {deleteDialog}

      <MobileQuickPaste
        open={mobilePasteOpen}
        onOpenChange={setMobilePasteOpen}
        selectedDateISO={fields.businessDate}
        targetOrder={order}
        onOrderCreatedOrUpdated={(updated) => {
          onSaved?.(updated);
        }}
      />

      <DocketScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        customerName={fields.fullName}
        onScanned={(scanned) => {
          setField("docketNumber", scanned);
        }}
      />
    </>
  );
}

function LabeledField({
  label,
  children,
  onPaste,
  onScan,
}: {
  label: string;
  children: React.ReactNode;
  onPaste?: () => void;
  onScan?: () => void;
}) {
  return (
    <label className="block rounded-lg border border-border bg-background/60 px-2 py-1 transition-colors focus-within:border-primary/50">
      <div className="flex items-center justify-between">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1">
          {onScan && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onScan();
              }}
              className="text-[10px] text-primary hover:text-primary/80 font-bold inline-flex items-center gap-0.5 px-1 py-0.2 rounded hover:bg-primary/10 transition-colors"
              title="Scan barcode with camera"
            >
              <Camera className="h-2.5 w-2.5" />
              <span>Scan</span>
            </button>
          )}
          {onPaste && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPaste();
              }}
              className="text-[10px] text-primary hover:text-primary/80 font-medium inline-flex items-center gap-0.5 px-1 py-0.2 rounded hover:bg-primary/10 transition-colors"
              title={`Paste into ${label}`}
            >
              <ClipboardPaste className="h-2.5 w-2.5" />
              <span>Paste</span>
            </button>
          )}
        </div>
      </div>
      {children}
    </label>
  );
}

/**
 * Memoized so that a save/add/delete affecting one row (which replaces the
 * `orders` array in the parent) does not re-render every other row. Unchanged
 * rows keep the same `order` reference and stable callbacks, so they skip.
 */
export const NotebookRow = React.memo(NotebookRowInner);
