"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, Printer, X, Pencil, Loader2 } from "lucide-react";
import type { OrderDTO, BusinessSettingsDTO } from "@/types";
import { OrderSlip, SLIP_W } from "@/components/orders/order-slip";
import { Button } from "@/components/ui/button";
import { downloadSlipPng, printSlip } from "@/lib/print/export";
import { toast } from "@/components/ui/use-toast";
import { missingRequiredFields } from "@/lib/validation/order";

export function PreviewPanel({
  order,
  settings,
  open,
  onOpenChange,
  onEdit,
}: {
  order: OrderDTO | null;
  settings: BusinessSettingsDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit?: (order: OrderDTO) => void;
}) {
  const slipRef = React.useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [scale, setScale] = React.useState(1);
  const frameRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  // Scale the slip to fit the available width on small screens.
  React.useEffect(() => {
    if (!open) return;
    const fit = () => {
      const w = frameRef.current?.clientWidth ?? SLIP_W;
      setScale(Math.min(1, w / SLIP_W));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open]);

  const missing = order ? missingRequiredFields(order) : [];
  const incomplete = missing.length > 0;

  async function handleDownload() {
    if (!slipRef.current || !order) return;
    setDownloading(true);
    try {
      await downloadSlipPng(slipRef.current, order.docketNumber);
      toast({ variant: "success", title: "Image downloaded", description: "The order slip PNG has been saved." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: e instanceof Error ? e.message : "Could not generate the image.",
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-brand-navy/40 backdrop-blur-sm data-[state=open]:animate-fade-in no-print" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl data-[state=open]:animate-slide-in-right focus:outline-none no-print"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <DialogPrimitive.Title className="text-base font-semibold text-brand-navy dark:text-foreground">
              Order Preview
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="grid h-8 w-8 place-items-center rounded-md hover:bg-secondary" aria-label="Close preview">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {order && (
            <>
              <div className="flex-1 overflow-y-auto bg-muted/40 p-5">
                {incomplete && (
                  <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                    This is a draft. Missing: {missing.join(", ")}. Printing is
                    allowed, but finalize the record for a complete slip.
                  </div>
                )}
                <div ref={frameRef} className="mx-auto" style={{ width: "100%", maxWidth: SLIP_W }}>
                  <div
                    style={{
                      height: 576 * scale,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
                      <div className="rounded-md shadow-md ring-1 ring-border overflow-hidden">
                        <OrderSlip ref={slipRef} order={order} settings={settings} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border p-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleDownload} disabled={downloading} variant="default">
                    {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download Image
                  </Button>
                  <Button onClick={printSlip} variant="teal">
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
                <div className="mt-2 flex gap-2">
                  {onEdit && (
                    <Button variant="outline" className="flex-1" onClick={() => onEdit(order)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  )}
                  <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                </div>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Final print size depends on your printer driver, paper size,
                  and browser print settings (target: 4 × 6 in).
                </p>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>

      {/* Off-screen print surface (portaled to body so no transformed ancestors).
          Hidden on screen; revealed and sized to 4x6in by print CSS. */}
      {mounted && open && order
        ? createPortal(
            <div
              aria-hidden
              style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}
            >
              <OrderSlip order={order} settings={settings} printSurface />
            </div>,
            document.body
          )
        : null}
    </DialogPrimitive.Root>
  );
}
