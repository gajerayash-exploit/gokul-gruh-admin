"use client";

import * as React from "react";
import { Loader2, CheckCircle2, Trash2, Save, Camera } from "lucide-react";
import { DocketScannerDialog } from "@/components/orders/docket-scanner-dialog";
import type { OrderDTO, BusinessSettingsDTO } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAutosave } from "@/components/notebook/use-autosave";
import { SaveStatus } from "@/components/notebook/save-status";
import { api, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/use-toast";
import { weekdayFromISO } from "@/lib/dates";
import { cn, formatINR } from "@/lib/utils";
import { OrderItemsEditor } from "@/components/orders/order-items-editor";
import { DayBadge } from "@/components/ui/day-badge";

/**
 * Edit dialog reusing the same autosave semantics as the notebook, plus an
 * explicit "Finalize" action that validates all required fields.
 */
export function OrderEditDialog({
  order,
  settings,
  open,
  onOpenChange,
  onChanged,
  onDeleted,
}: {
  order: OrderDTO | null;
  settings: BusinessSettingsDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: (o: OrderDTO) => void;
  onDeleted?: (id: string) => void;
}) {
  if (!order) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <EditForm
          key={order.id}
          order={order}
          settings={settings}
          onChanged={onChanged}
          onDeleted={(id) => {
            onDeleted?.(id);
            onOpenChange(false);
          }}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  order,
  settings,
  onChanged,
  onDeleted,
  onClose,
}: {
  order: OrderDTO;
  settings: BusinessSettingsDTO;
  onChanged?: (o: OrderDTO) => void;
  onDeleted?: (id: string) => void;
  onClose: () => void;
}) {
  const save = useAutosave(order, { onSaved: onChanged });
  const { fields, setField, saveState, lastSavedAt, retry, missing, isComplete, phoneValid, amount } = save;
  const [finalizing, setFinalizing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [scannerOpen, setScannerOpen] = React.useState(false);

  async function finalize() {
    setFinalizing(true);
    try {
      save.flush();
      const { order: updated } = await api.updateOrder(order.id, { ...fields, finalize: true });
      onChanged?.(updated);
      toast({ variant: "success", title: "Order finalized", description: "The record is complete and ready to print." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not finalize",
        description: e instanceof ApiError ? e.message : "Please check the fields.",
      });
    } finally {
      setFinalizing(false);
    }
  }

  async function doDelete() {
    try {
      await api.deleteOrder(order.id);
      onDeleted?.(order.id);
      toast({ variant: "success", title: "Record deleted" });
    } catch (e) {
      toast({ variant: "destructive", title: "Delete failed", description: e instanceof Error ? e.message : "" });
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit order</DialogTitle>
        <DialogDescription>
          Changes autosave. The business date and weekday stay with the record.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="e-date">Date</Label>
            <Input
              id="e-date"
              type="date"
              value={fields.businessDate}
              onChange={(e) => setField("businessDate", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Day</Label>
            <div className="flex h-9 items-center rounded-md border border-input bg-muted/20 px-2.5">
              <DayBadge day={weekdayFromISO(fields.businessDate)} variant="header" />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="e-name">Full Name</Label>
          <Input id="e-name" value={fields.fullName} onChange={(e) => setField("fullName", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="e-phone">Phone Number</Label>
            <Input
              id="e-phone"
              value={fields.phoneNumber}
              inputMode="tel"
              aria-invalid={!phoneValid}
              className={cn(!phoneValid && "border-destructive")}
              onChange={(e) => setField("phoneNumber", e.target.value)}
            />
            {!phoneValid && <p className="text-xs text-destructive">Invalid Indian mobile number.</p>}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="e-docket">Docket Number</Label>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="text-xs text-primary hover:text-primary/80 font-bold inline-flex items-center gap-1"
                title="Scan barcode with camera"
              >
                <Camera className="h-3 w-3" />
                <span>Scan</span>
              </button>
            </div>
            <Input id="e-docket" value={fields.docketNumber} onChange={(e) => setField("docketNumber", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="e-address">Address</Label>
          <Textarea id="e-address" value={fields.address} onChange={(e) => setField("address", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Order Items / Sub-Entries</Label>
          <div className="rounded-lg border border-border bg-muted/20 p-2.5">
            <OrderItemsEditor
              order={order}
              onOrderUpdated={(updated) => {
                onChanged?.(updated);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="e-type">Summary / Custom Note</Label>
          <Input id="e-type" list="ggu-order-types-edit" value={fields.orderType} onChange={(e) => setField("orderType", e.target.value)} />
          <datalist id="ggu-order-types-edit">
            {settings.orderTypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="e-qty">Quantity</Label>
            <Input
              id="e-qty"
              inputMode="numeric"
              className="text-right tabular-nums"
              value={fields.quantity}
              onChange={(e) => setField("quantity", e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="e-rate">Unit Price (₹)</Label>
            <Input
              id="e-rate"
              inputMode="decimal"
              className="text-right tabular-nums"
              value={fields.unitPrice}
              onChange={(e) =>
                setField("unitPrice", e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Amount</Label>
            <div className="flex h-9 items-center justify-end rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold tabular-nums">
              {amount > 0 ? formatINR(amount) : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <SaveStatus state={saveState} lastSavedAt={lastSavedAt} onRetry={retry} />
        {!isComplete && (
          <span className="text-xs text-warning-foreground">Missing: {missing.join(", ")}</span>
        )}
      </div>

      <DialogFooter className="sm:justify-between">
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            <Save className="h-4 w-4" /> Done
          </Button>
          <Button onClick={finalize} disabled={!isComplete || finalizing}>
            {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Finalize
          </Button>
        </div>
      </DialogFooter>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this order?</DialogTitle>
            <DialogDescription>
              This affects stored business history. The record is soft-deleted and kept in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete}>Delete record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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