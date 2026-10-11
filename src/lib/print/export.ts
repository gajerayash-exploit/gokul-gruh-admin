"use client";

import { sanitizeFilename } from "@/lib/utils";
import { SLIP_W, SLIP_H } from "@/components/orders/order-slip";

const TARGET_W = 1200;
const TARGET_H = 1800;

/**
 * Render the given slip node to a high-resolution PNG (1200 x 1800, 2:3,
 * ~300dpi for 4x6in) and trigger a download. Waits for fonts/images first.
 */
export async function downloadSlipPng(
  node: HTMLElement,
  docketNumber: string
): Promise<void> {
  // Ensure web fonts are ready so text metrics are correct.
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  // Lazy-load html-to-image only when the user actually exports, so it
  // stays out of the notebook/preview bundle.
  const { toPng } = await import("html-to-image");

  const dataUrl = await toPng(node, {
    width: SLIP_W,
    height: SLIP_H,
    pixelRatio: TARGET_W / SLIP_W, // 1200/384 = 3.125 -> 1200 x 1800
    backgroundColor: "#ffffff",
    cacheBust: true,
    style: { margin: "0", transform: "none" },
  });

  const safeDocket = sanitizeFilename(docketNumber || "slip");
  const link = document.createElement("a");
  link.download = `GokulGruhUdhyog_Order_${safeDocket}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export { TARGET_W, TARGET_H };

/** Trigger the browser print dialog (print CSS isolates the slip surface). */
export function printSlip(): void {
  window.print();
}
