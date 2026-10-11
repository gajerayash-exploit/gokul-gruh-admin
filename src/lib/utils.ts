import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Build a safe filename for downloads (strips path/illegal chars). */
export function sanitizeFilename(value: string, fallback = "order"): string {
  const cleaned = (value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.length ? cleaned : fallback;
}

/** Coerce an unknown value (string from an input, number, null) to a finite
 *  non-negative number. Blank / invalid / negative becomes 0. */
export function toAmount(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a rupee amount as "₹1,234.50" (Indian digit grouping). */
export function formatINR(amount: number): string {
  return inrFormatter.format(Number.isFinite(amount) ? amount : 0);
}

/** Round a rupee value to 2 decimal places (avoids float display artifacts). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}


/** Debounce helper preserving the latest args. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number
): ((...args: A) => void) & { cancel: () => void; flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;
  const wrapped = (...args: A) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
    }, delay);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      if (lastArgs) fn(...lastArgs);
    }
  };
  return wrapped;
}
