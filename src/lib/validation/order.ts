import { z } from "zod";

/**
 * Normalize an Indian mobile number. Accepts input with/without +91,
 * spaces, hyphens, parentheses, or a leading 0. Returns a canonical
 * "+91XXXXXXXXXX" string, or null if it is not a valid Indian mobile.
 * Never fabricates digits — only strips formatting and known prefixes.
 */
export function normalizeIndianPhone(input: string): string | null {
  if (!input) return null;
  // Keep digits only (drop +, spaces, hyphens, parentheses).
  let digits = input.replace(/[^\d]/g, "");

  // Strip common country/trunk prefixes.
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  else if (digits.length === 13 && digits.startsWith("091")) digits = digits.slice(3);

  // Valid Indian mobile: exactly 10 digits beginning 6-9.
  if (/^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }
  return null;
}

/** Pretty display: "+91 98765 43210". */
export function formatPhoneForDisplay(normalized: string): string {
  const m = normalized.match(/^\+91(\d{5})(\d{5})$/);
  if (m) return `+91 ${m[1]} ${m[2]}`;
  return normalized;
}

const trimmed = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max));

/**
 * Full validation for a FINALIZED (Complete) order. All essential fields
 * must be present and valid before an order can be printed.
 */
export const completeOrderSchema = z.object({
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required (YYYY-MM-DD)."),
  fullName: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, "Full name is required.")
        .max(120, "Name is too long.")
    ),
  phoneNumber: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => normalizeIndianPhone(v) !== null, {
      message: "Enter a valid Indian mobile number (10 digits, starts 6–9).",
    })
    .transform((v) => normalizeIndianPhone(v) as string),
  address: z
    .string()
    .transform((v) => v.replace(/[ \t]+\n/g, "\n").trim())
    .pipe(z.string().min(1, "Address is required.").max(500, "Address is too long.")),
  orderType: trimmed(80).pipe(z.string().min(1, "Order type is required.")),
  docketNumber: trimmed(60).pipe(
    z.string().min(1, "Docket number is required.")
  ),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity is required."),
  unitPrice: z.coerce.number().gt(0, "Unit price is required."),
});

/**
 * Lenient schema for autosaved DRAFTS — any field may be partial/empty.
 * We still trim and normalize what is present, but nothing is required.
 */
export const draftOrderSchema = z.object({
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.")
    .optional(),
  fullName: z.string().max(120).optional(),
  phoneNumber: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
  orderType: z.string().max(80).optional(),
  docketNumber: z.string().max(60).optional(),
});

export type CompleteOrderInput = z.infer<typeof completeOrderSchema>;
export type DraftOrderInput = z.infer<typeof draftOrderSchema>;

/** Which fields are still missing for finalization (for UI hints). */
export function missingRequiredFields(o: {
  fullName?: string;
  phoneNumber?: string;
  address?: string;
  orderType?: string;
  docketNumber?: string;
  quantity?: number | string;
  unitPrice?: number | string;
}): string[] {
  const num = (v: number | string | undefined) => {
    const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  };
  const missing: string[] = [];
  if (!o.fullName?.trim()) missing.push("Full Name");
  if (!o.phoneNumber?.trim() || !normalizeIndianPhone(o.phoneNumber))
    missing.push("Phone Number");
  if (!o.address?.trim()) missing.push("Address");
  if (!o.orderType?.trim()) missing.push("Order Type");
  if (!o.docketNumber?.trim()) missing.push("Docket Number");
  if (num(o.quantity) < 1) missing.push("Quantity");
  if (num(o.unitPrice) <= 0) missing.push("Unit Price");
  return missing;
}

export function isOrderComplete(o: {
  fullName?: string;
  phoneNumber?: string;
  address?: string;
  orderType?: string;
  docketNumber?: string;
  quantity?: number | string;
  unitPrice?: number | string;
}): boolean {
  return missingRequiredFields(o).length === 0;
}
