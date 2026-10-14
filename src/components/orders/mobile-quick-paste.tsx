"use client";

import * as React from "react";
import {
  ClipboardPaste,
  Sparkles,
  User,
  Phone,
  MapPin,
  ShoppingBag,
  Hash,
  Loader2,
  Check,
  Plus,
  Trash2,
  ArrowRight,
  X,
  Smartphone,
  Calendar,
  CalendarDays,
  Camera,
} from "lucide-react";
import { DocketScannerDialog } from "@/components/orders/docket-scanner-dialog";
import { todayISODate, tomorrowISODate, formatDisplayDate, weekdayFromISO } from "@/lib/dates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/lib/api/client";
import { parseCustomerText, type ParsedCustomerDetails } from "@/lib/parser/customer-text";
import { GOKUL_ITEMS } from "@/components/orders/items-scroll-list";
import type { OrderDTO } from "@/types";
import { cn } from "@/lib/utils";

export interface MobileQuickPasteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDateISO: string;
  targetOrder?: OrderDTO | null;
  onOrderCreatedOrUpdated: (order: OrderDTO) => void;
}

export function MobileQuickPaste({
  open,
  onOpenChange,
  selectedDateISO,
  targetOrder,
  onOrderCreatedOrUpdated,
}: MobileQuickPasteProps) {
  const [rawText, setRawText] = React.useState("");
  const [parsed, setParsed] = React.useState<ParsedCustomerDetails>({
    fullName: "",
    phoneNumber: "",
    address: "",
    docketNumber: "",
    items: [],
    orderType: "",
    rawText: "",
  });
  const [orderDate, setOrderDate] = React.useState(selectedDateISO || todayISODate());
  const [submitting, setSubmitting] = React.useState(false);
  const [canReadClipboard, setCanReadClipboard] = React.useState(true);
  const [scannerOpen, setScannerOpen] = React.useState(false);

  // Sync orderDate with selectedDateISO when prop changes
  React.useEffect(() => {
    if (selectedDateISO) setOrderDate(selectedDateISO);
  }, [selectedDateISO]);

  // Auto-parse whenever rawText changes
  React.useEffect(() => {
    if (!rawText.trim()) {
      setParsed({
        fullName: "",
        phoneNumber: "",
        address: "",
        docketNumber: "",
        items: [],
        orderType: "",
        rawText: "",
      });
      return;
    }
    const result = parseCustomerText(rawText);
    setParsed(result);

    // If customer message explicitly requests tomorrow / kal, auto-select tomorrow!
    if (result.deliveryDateHint === "tomorrow") {
      setOrderDate(tomorrowISODate());
    } else if (result.deliveryDateHint === "today") {
      setOrderDate(todayISODate());
    }
  }, [rawText]);

  // Handle direct 1-tap clipboard paste
  async function handlePasteFromClipboard() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setRawText(text);
          toast({
            variant: "success",
            title: "Pasted from clipboard",
            description: "Customer details extracted successfully.",
          });
          return;
        }
      }
      toast({
        variant: "warning",
        title: "Clipboard empty",
        description: "Please copy text on your phone and try again, or paste directly into the box.",
      });
    } catch (e) {
      setCanReadClipboard(false);
      toast({
        variant: "default",
        title: "Please paste into the box",
        description: "Tap the box below and press Paste on your phone keyboard.",
      });
    }
  }

  function handleAddItem(itemName: string) {
    const itemDef = GOKUL_ITEMS.find((it) => it.name === itemName);
    setParsed((prev) => {
      const exists = prev.items.find((it) => it.itemName === itemName);
      if (exists) {
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.itemName === itemName ? { ...it, quantity: it.quantity + 1 } : it
          ),
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            itemName,
            quantity: 1,
            unitPrice: itemDef?.defaultPrice || 0,
          },
        ],
      };
    });
  }

  function handleRemoveItem(itemName: string) {
    setParsed((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.itemName !== itemName),
    }));
  }

  function handleUpdateItemQty(itemName: string, delta: number) {
    setParsed((prev) => ({
      ...prev,
      items: prev.items
        .map((it) => {
          if (it.itemName === itemName) {
            const nextQty = Math.max(1, it.quantity + delta);
            return { ...it, quantity: nextQty };
          }
          return it;
        })
        .filter((it) => it.quantity > 0),
    }));
  }

  function handleUpdateItemPrice(itemName: string, price: number) {
    setParsed((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.itemName === itemName ? { ...it, unitPrice: Math.max(0, price) } : it
      ),
    }));
  }

  async function handleSave(stayOpen = false) {
    if (!parsed.fullName.trim() && !parsed.phoneNumber.trim() && !parsed.address.trim()) {
      toast({
        variant: "destructive",
        title: "Missing details",
        description: "Please enter or paste at least the customer's name, phone, or address.",
      });
      return;
    }

    setSubmitting(true);
    try {
      let finalOrder: OrderDTO;

      if (targetOrder) {
        // Updating existing draft/order
        const updated = await api.updateOrder(targetOrder.id, {
          fullName: parsed.fullName || targetOrder.fullName,
          phoneNumber: parsed.phoneNumber || targetOrder.phoneNumber,
          address: parsed.address || targetOrder.address,
          docketNumber: parsed.docketNumber || targetOrder.docketNumber,
          orderType: parsed.orderType || targetOrder.orderType,
        });
        finalOrder = updated.order;

        // Update or add newly parsed items with manual unit prices
        for (const it of parsed.items) {
          const existingItem = finalOrder.items?.find(
            (x) => x.itemName.trim().toLowerCase() === it.itemName.trim().toLowerCase()
          );
          if (existingItem) {
            const res = await api.updateOrderItem(finalOrder.id, existingItem.id, {
              quantity: it.quantity,
              unitPrice: it.unitPrice || 0,
            });
            finalOrder = res.order;
          } else {
            const res = await api.addOrderItem(finalOrder.id, {
              itemName: it.itemName,
              quantity: it.quantity,
              unitPrice: it.unitPrice || 0,
            });
            finalOrder = res.order;
          }
        }
      } else {
        // Create clean order draft for the chosen orderDate
        const draft = await api.createDraft(orderDate);

        // Update with customer details
        const updated = await api.updateOrder(draft.order.id, {
          fullName: parsed.fullName,
          phoneNumber: parsed.phoneNumber,
          address: parsed.address,
          docketNumber: parsed.docketNumber,
          orderType: parsed.orderType || (parsed.items[0]?.itemName || "Regular"),
        });
        finalOrder = updated.order;

        // Add ALL parsed items with their EXACT unit rates and quantities
        for (const it of parsed.items) {
          const res = await api.addOrderItem(finalOrder.id, {
            itemName: it.itemName,
            quantity: it.quantity,
            unitPrice: it.unitPrice || 0,
          });
          finalOrder = res.order;
        }
      }

      onOrderCreatedOrUpdated(finalOrder);

      toast({
        variant: "success",
        title: targetOrder ? "Order updated" : "Order created!",
        description: `${parsed.fullName || "Customer"} record saved with ${parsed.items.length} items.`,
      });

      if (stayOpen) {
        // Clear for next customer entry
        setRawText("");
        setParsed({
          fullName: "",
          phoneNumber: "",
          address: "",
          docketNumber: "",
          items: [],
          orderType: "",
          rawText: "",
        });
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save order",
        description: e instanceof Error ? e.message : "Please check your network and retry.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const hasExtractedData = Boolean(
    parsed.fullName || parsed.phoneNumber || parsed.address || parsed.items.length > 0
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg p-0 gap-0 overflow-hidden sm:rounded-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-primary/5 border-b border-border px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-2xs">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-brand-navy dark:text-foreground">
                  {targetOrder ? "Paste to Customer Order" : "Quick Paste Order"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Paste WhatsApp message or customer text to auto-fill
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePasteFromClipboard}
              className="gap-1.5 h-8 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              <span>Paste Clipboard</span>
            </Button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Paste Input Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="customer-raw-paste"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                1. Customer WhatsApp / SMS Message
              </label>
              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText("")}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            <Textarea
              id="customer-raw-paste"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Tap here and Paste customer message...&#10;e.g.&#10;Rameshbhai Patel&#10;9825012345&#10;B-204 Shivalik Heights, Surat&#10;Kothimba 2, Guvar 1&#10;Deliver tomorrow"
              rows={3}
              className="text-sm bg-muted/30 focus:bg-background transition-colors leading-relaxed resize-none rounded-xl"
            />
          </div>

          {/* Order Delivery Date Selector (Today vs Tomorrow vs Custom) */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                Delivery / Order Date
              </span>
              {parsed.deliveryDateHint === "tomorrow" && (
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  ✨ Tomorrow detected
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOrderDate(todayISODate())}
                className={cn(
                  "flex-1 min-w-[100px] rounded-lg border px-3 py-1.5 text-xs font-semibold text-center transition-all",
                  orderDate === todayISODate()
                    ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                    : "bg-muted/40 hover:bg-muted text-foreground border-border"
                )}
              >
                Today ({formatDisplayDate(todayISODate()).slice(0, 5)})
              </button>
              <button
                type="button"
                onClick={() => setOrderDate(tomorrowISODate())}
                className={cn(
                  "flex-1 min-w-[120px] rounded-lg border px-3 py-1.5 text-xs font-semibold text-center transition-all",
                  orderDate === tomorrowISODate()
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                    : "bg-muted/40 hover:bg-muted text-foreground border-border"
                )}
              >
                Tomorrow ({formatDisplayDate(tomorrowISODate()).slice(0, 5)}) ❯
              </button>
              <div className="flex items-center rounded-lg border border-border bg-muted/30 px-2 py-1">
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value || todayISODate())}
                  className="bg-transparent text-xs text-foreground outline-none"
                  aria-label="Custom order date"
                />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Register date: <span className="font-semibold text-foreground">{formatDisplayDate(orderDate)}</span> ({weekdayFromISO(orderDate)})
            </div>
          </div>

          {/* Extracted Fields Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                2. Extracted Details (Editable)
              </span>
              {hasExtractedData && (
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  <Check className="h-2.5 w-2.5 mr-1" /> Ready
                </Badge>
              )}
            </div>

            {/* Name */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 sm:p-2.5">
              <User className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                  Customer Name
                </span>
                <input
                  type="text"
                  value={parsed.fullName}
                  onChange={(e) => setParsed({ ...parsed, fullName: e.target.value })}
                  placeholder="Customer Full Name"
                  className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Phone & Docket in 2 cols */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 sm:p-2.5">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
                <div className="flex-1 min-w-0">
                  <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                    Mobile Phone
                  </span>
                  <input
                    type="tel"
                    value={parsed.phoneNumber}
                    onChange={(e) => setParsed({ ...parsed, phoneNumber: e.target.value })}
                    placeholder="9825012345"
                    className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card p-2 sm:p-2.5">
                <Hash className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
                <div className="flex-1 min-w-0">
                  <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                    Docket / Slip #
                  </span>
                  <input
                    type="text"
                    value={parsed.docketNumber}
                    onChange={(e) => setParsed({ ...parsed, docketNumber: e.target.value })}
                    placeholder="Optional docket #"
                    className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="p-1 rounded text-primary hover:bg-primary/10 transition-colors"
                  title="Scan docket barcode"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-2 sm:p-2.5">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 ml-1 mt-1" />
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                  Delivery Address
                </span>
                <textarea
                  rows={2}
                  value={parsed.address}
                  onChange={(e) => setParsed({ ...parsed, address: e.target.value })}
                  placeholder="Flat / House, Society, Road, Area, City"
                  className="w-full bg-transparent text-sm text-foreground outline-none resize-none placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Items Section */}
            <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Order Items ({parsed.items.length})
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">Tap to add</span>
              </div>

              {/* Quick Item Picker Chips */}
              <div className="flex flex-wrap gap-1.5">
                {GOKUL_ITEMS.map((item) => {
                  const isSelected = parsed.items.some((it) => it.itemName === item.name);
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => handleAddItem(item.name)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/40 hover:bg-muted text-foreground border-border"
                      )}
                    >
                      <Plus className="h-3 w-3" />
                      <span>{item.name}</span>
                      <span className="opacity-70 text-[10px]">({item.gujarati})</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Items List with Quantity Steppers */}
              {parsed.items.length > 0 && (
                <div className="pt-2 border-t border-border/60 space-y-1.5">
                  {parsed.items.map((it) => (
                    <div
                      key={it.itemName}
                      className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs gap-2"
                    >
                      <span className="font-semibold text-foreground min-w-[60px]">{it.itemName}</span>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        {/* Quantity stepper */}
                        <div className="flex items-center rounded-md border border-border bg-card">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(it.itemName, -1)}
                            className="px-2 py-0.5 text-xs hover:bg-secondary font-bold text-muted-foreground hover:text-foreground"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold tabular-nums text-foreground">
                            {it.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(it.itemName, 1)}
                            className="px-2 py-0.5 text-xs hover:bg-secondary font-bold text-muted-foreground hover:text-foreground"
                          >
                            +
                          </button>
                        </div>
                        {/* Price input */}
                        <div className="flex items-center gap-0.5">
                          <span className="text-[10px] text-muted-foreground font-medium">₹</span>
                          <input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="Rate"
                            value={it.unitPrice || ""}
                            onChange={(e) => {
                              const p = parseFloat(e.target.value);
                              handleUpdateItemPrice(it.itemName, isNaN(p) ? 0 : p);
                            }}
                            className={cn(
                              "w-16 rounded border px-1.5 py-0.5 text-right text-xs font-semibold tabular-nums outline-none transition-colors",
                              !it.unitPrice
                                ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 focus:border-primary placeholder:text-amber-500"
                                : "border-border/50 bg-background focus:border-primary"
                            )}
                            title="Unit Rate (₹) — Enter price per quality"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.itemName)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {parsed.items.some((it) => !it.unitPrice) && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 pt-0.5">
                      ⚠ Enter price (₹) for highlighted items
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed Mobile Bottom Actions */}
        <div className="border-t border-border bg-card p-3 sm:px-6 flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-none text-xs"
          >
            Cancel
          </Button>
          {!targetOrder && (
            <Button
              type="button"
              variant="outline"
              disabled={submitting || !hasExtractedData}
              onClick={() => handleSave(true)}
              className="flex-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
            >
              Save & Next ❯
            </Button>
          )}
          <Button
            type="button"
            disabled={submitting || !hasExtractedData}
            onClick={() => handleSave(false)}
            className="flex-1 sm:flex-2 gap-1.5 font-bold bg-primary text-primary-foreground shadow-sm"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4 stroke-[3]" />
            )}
            {targetOrder ? "Apply to Order" : "Save Order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <DocketScannerDialog
      open={scannerOpen}
      onOpenChange={setScannerOpen}
      customerName={parsed.fullName}
      onScanned={(scanned) => {
        setParsed((p) => ({ ...p, docketNumber: scanned }));
      }}
    />
    </>
  );
}
