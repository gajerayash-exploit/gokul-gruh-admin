"use client";

import * as React from "react";
import { Plus, Trash2, ShoppingCart, Loader2 } from "lucide-react";
import type { OrderDTO, OrderItemDTO } from "@/types";
import { api } from "@/lib/api/client";
import { formatINR, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { GOKUL_ITEMS, type ItemDefinition } from "@/components/orders/items-scroll-list";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

interface OrderItemsEditorProps {
  order: OrderDTO;
  onOrderUpdated: (updated: OrderDTO) => void;
  compact?: boolean;
}

export function OrderItemsEditor({
  order,
  onOrderUpdated,
  compact = false,
}: OrderItemsEditorProps) {
  const [addingItem, setAddingItem] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customQty, setCustomQty] = React.useState("1");
  const [customPrice, setCustomPrice] = React.useState("");
  const [updatingItemId, setUpdatingItemId] = React.useState<string | null>(null);

  const items = order.items ?? [];

  async function handleAddItem(itemName: string, defaultQty = 1, defaultPrice = 0) {
    if (!itemName.trim()) return;
    setAddingItem(true);
    try {
      const res = await api.addOrderItem(order.id, {
        itemName: itemName.trim(),
        quantity: Math.max(1, defaultQty),
        unitPrice: Math.max(0, defaultPrice),
      });
      onOrderUpdated(res.order);
      setCustomName("");
      setCustomQty("1");
      setCustomPrice("");
      setPopoverOpen(false);
      toast({
        variant: "success",
        title: "Item added",
        description: `Added ${itemName} to order`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not add item",
        description: e instanceof Error ? e.message : "Please try again",
      });
    } finally {
      setAddingItem(false);
    }
  }

  async function handleUpdateItem(
    itemId: string,
    patch: { itemName?: string; quantity?: number; unitPrice?: number }
  ) {
    setUpdatingItemId(itemId);
    try {
      const res = await api.updateOrderItem(order.id, itemId, patch);
      onOrderUpdated(res.order);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: e instanceof Error ? e.message : "Please try again",
      });
    } finally {
      setUpdatingItemId(null);
    }
  }

  async function handleDeleteItem(itemId: string) {
    setUpdatingItemId(itemId);
    try {
      const res = await api.deleteOrderItem(order.id, itemId);
      onOrderUpdated(res.order);
      toast({ variant: "success", title: "Item removed" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Please try again",
      });
    } finally {
      setUpdatingItemId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Existing sub-entries */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {items.map((it) => (
            <div
              key={it.id}
              className="group inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-muted/80"
            >
              <span className="font-semibold text-brand-navy dark:text-foreground">
                {it.itemName}
              </span>
              <div className="flex items-center gap-1 text-muted-foreground">
                <input
                  type="number"
                  min={1}
                  className="w-10 rounded border border-border/50 bg-background px-1 py-0.5 text-center text-xs font-semibold tabular-nums outline-none focus:border-primary"
                  value={it.quantity}
                  title="Quantity"
                  onChange={(e) => {
                    const q = parseInt(e.target.value, 10);
                    if (!isNaN(q) && q > 0) {
                      handleUpdateItem(it.id, { quantity: q });
                    }
                  }}
                />
                <span>×</span>
                <input
                  type="number"
                  step="any"
                  min={0}
                  className="w-14 rounded border border-border/50 bg-background px-1 py-0.5 text-right text-xs font-semibold tabular-nums outline-none focus:border-primary"
                  value={it.unitPrice || ""}
                  placeholder="₹0"
                  title="Unit Rate (₹)"
                  onChange={(e) => {
                    const p = parseFloat(e.target.value);
                    handleUpdateItem(it.id, { unitPrice: isNaN(p) ? 0 : p });
                  }}
                />
                <span className="font-bold text-foreground">
                  = {formatINR(it.amount)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteItem(it.id)}
                disabled={updatingItemId === it.id}
                className="ml-0.5 text-muted-foreground hover:text-destructive opacity-70 group-hover:opacity-100 transition-opacity"
                title="Remove item"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick Add Popover with the scrollable list of items */}
      <div className="flex items-center gap-2">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-md text-xs font-medium border-dashed border-primary/40 text-primary hover:bg-brand-soft/50"
            >
              {addingItem ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Add Item / Sub-entry
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-3 shadow-lg">
            <div className="mb-2.5">
              <span className="text-xs font-bold text-brand-navy dark:text-foreground">
                Add Item to Customer Order
              </span>
              <p className="text-[11px] text-muted-foreground">
                Click an item from the list or enter a custom item:
              </p>
            </div>

            {/* Quick 6 items list */}
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              {GOKUL_ITEMS.map((gItem) => (
                <button
                  key={gItem.name}
                  type="button"
                  disabled={addingItem}
                  onClick={() => handleAddItem(gItem.name, 1, gItem.defaultPrice ?? 0)}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary hover:bg-brand-soft/40"
                >
                  <span className="font-medium text-foreground">{gItem.name}</span>
                  <span className="text-[10px] text-muted-foreground">{gItem.gujarati}</span>
                </button>
              ))}
            </div>

            {/* Custom item input */}
            <div className="border-t border-border pt-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Or custom item:
              </span>
              <div className="mt-1 flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Item name…"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    className="w-20 rounded border border-input bg-background px-2 py-1 text-xs tabular-nums outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    step="any"
                    min={0}
                    placeholder="Rate ₹"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs tabular-nums outline-none focus:border-primary"
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={!customName.trim() || addingItem}
                    onClick={() =>
                      handleAddItem(
                        customName,
                        parseInt(customQty, 10) || 1,
                        parseFloat(customPrice) || 0
                      )
                    }
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {items.length > 0 && (
          <span className="text-xs text-muted-foreground font-medium">
            Total {order.quantity} item{order.quantity === 1 ? "" : "s"} · Amount:{" "}
            <span className="font-bold text-brand-navy dark:text-foreground">
              {formatINR(order.amount)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
