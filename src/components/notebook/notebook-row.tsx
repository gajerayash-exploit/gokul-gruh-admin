"use client";

import * as React from "react";
import {
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
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
  const dupTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
    "w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-brand-soft/60 dark:focus:bg-primary/10 rounded placeholder:text-muted-foreground/60";

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
  const typeInput = (
    <>
      <input
        data-cell={`${order.id}:orderType`}
        className={inputCls}
        value={fields.orderType}
        placeholder="Order type"
        list="ggu-order-types"
        onChange={(e) => setField("orderType", e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "orderType")}
        aria-label="Order type"
      />
    </>
  );
  const docketInput = (
    <div className="flex items-center gap-1">
      <input
        data-cell={`${order.id}:docketNumber`}
        className={cn(inputCls, hasDuplicate && "text-warning-foreground")}
        value={fields.docketNumber}
        placeholder="Docket #"
        onChange={(e) => setField("docketNumber", e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, "docketNumber")}
        aria-label="Docket number"
      />
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

  const qtyInput = (
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
  const rateInput = (
    <input
      data-cell={`${order.id}:unitPrice`}
      className={cn(inputCls, "text-right tabular-nums")}
      value={fields.unitPrice}
      placeholder="0.00"
      inputMode="decimal"
      onChange={(e) =>
        setField("unitPrice", e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))
      }
      onKeyDown={(e) => handleKeyDown(e, "unitPrice")}
      aria-label="Unit price in rupees"
    />
  );
  const amountCell = (
    <span className="w-full px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-brand-navy dark:text-foreground">
      {amount > 0 ? formatINR(amount) : <span className="text-muted-foreground/60">—</span>}
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
        className={cn(
          "hidden lg:grid grid-cols-[92px_84px_1.3fr_120px_1.4fr_0.9fr_50px_86px_96px_108px_100px] items-stretch border-b border-border transition-colors",
          index % 2 === 1 && "bg-muted/30",
          "hover:bg-brand-soft/30 dark:hover:bg-primary/5"
        )}
      >
        <div className="flex items-center border-r border-border/70 px-1">{dateCell}</div>
        <div className="flex items-center border-r border-border/70 px-2 text-xs text-muted-foreground whitespace-nowrap">
          {weekday}
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

      {/* Mobile card */}
      <div className="lg:hidden rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDisplayDate(fields.businessDate)} · {weekday || "—"}
          </div>
          <div className="flex items-center gap-2">
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
          <LabeledField label="Full Name">{nameInput}</LabeledField>
          <div className="grid grid-cols-2 gap-2">
            <LabeledField label="Phone">{phoneInput}</LabeledField>
            <LabeledField label="Docket">{docketInput}</LabeledField>
          </div>
          <LabeledField label="Address">{addressInput}</LabeledField>
          <LabeledField label="Order Type">{typeInput}</LabeledField>
          <div className="grid grid-cols-3 gap-2">
            <LabeledField label="Qty">{qtyInput}</LabeledField>
            <LabeledField label="Rate (₹)">{rateInput}</LabeledField>
            <LabeledField label="Amount">{amountCell}</LabeledField>
          </div>
          <LabeledField label="Date">{dateCell}</LabeledField>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
          <SaveStatus state={saveState} lastSavedAt={lastSavedAt} onRetry={retry} />
          {actions}
        </div>
      </div>

      {deleteDialog}
    </>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block rounded-lg border border-border bg-background/60 px-2 py-1">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
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
