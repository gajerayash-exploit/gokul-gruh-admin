"use client";

import * as React from "react";
import { Upload, ClipboardPaste, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/use-toast";
import { normalizeIndianPhone } from "@/lib/validation/order";
import { formatDisplayDate } from "@/lib/dates";
import { toAmount, formatINR } from "@/lib/utils";

type Field = "ignore" | "businessDate" | "fullName" | "phoneNumber" | "address" | "orderType" | "docketNumber" | "quantity" | "unitPrice";

const FIELD_LABELS: Record<Field, string> = {
  ignore: "Ignore",
  businessDate: "Date (YYYY-MM-DD or DD/MM/YYYY)",
  fullName: "Full Name",
  phoneNumber: "Phone Number",
  address: "Address",
  orderType: "Order Type",
  docketNumber: "Docket Number",
  quantity: "Quantity",
  unitPrice: "Unit Price (₹)",
};

function guessField(header: string): Field {
  const h = header.toLowerCase().trim();
  if (/(qty|quantity|pcs|pieces|nos)/.test(h)) return "quantity";
  if (/(rate|price|unit|amount|cost|mrp|₹|rs)/.test(h)) return "unitPrice";
  if (/(name)/.test(h)) return "fullName";
  if (/(phone|mobile|contact|number)/.test(h)) return "phoneNumber";
  if (/(address|location|area)/.test(h)) return "address";
  if (/(type|item|product|order)/.test(h)) return "orderType";
  if (/(docket|slip|token|bill|invoice)/.test(h)) return "docketNumber";
  if (/(date|day)/.test(h)) return "businessDate";
  return "ignore";
}

function normalizeDate(raw: string, fallbackISO: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return fallbackISO;
}

// __BULK_BODY__
interface MappedRow {
  businessDate: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  orderType: string;
  docketNumber: string;
  quantity: string;
  unitPrice: string;
  amount: number;
  complete: boolean;
  phoneValid: boolean;
}

export function BulkPasteDialog({
  open,
  onOpenChange,
  defaultDateISO,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDateISO: string;
  onImported: (count: number) => void;
}) {
  const [raw, setRaw] = React.useState("");
  const [table, setTable] = React.useState<string[][]>([]);
  const [hasHeader, setHasHeader] = React.useState(true);
  const [mapping, setMapping] = React.useState<Field[]>([]);
  const [importing, setImporting] = React.useState(false);
  const importIdRef = React.useRef<string>("");

  function reset() {
    setRaw("");
    setTable([]);
    setMapping([]);
    setHasHeader(true);
  }

  async function parse(text: string) {
    // Lazy-load papaparse on first use so it stays out of the notebook bundle.
    const Papa = (await import("papaparse")).default;
    const result = Papa.parse<string[]>(text.trim(), {
      skipEmptyLines: true,
    });
    const rows = (result.data as string[][]).filter((r) => r.some((c) => c && c.trim()));
    setTable(rows);
    if (rows.length) {
      const first = rows[0];
      const looksHeader = first.some((c) => guessField(c) !== "ignore" && /[a-z]/i.test(c) && !/\d{3,}/.test(c));
      setHasHeader(looksHeader);
      setMapping(first.map((c) => (looksHeader ? guessField(c) : "ignore")));
    }
  }

  function handlePaste(text: string) {
    setRaw(text);
    void parse(text);
  }

  async function handleFile(file: File) {
    const text = await file.text();
    handlePaste(text);
  }

  const dataRows = hasHeader ? table.slice(1) : table;

  const mapped: MappedRow[] = React.useMemo(() => {
    return dataRows.map((cols) => {
      const get = (f: Field) => {
        const idx = mapping.indexOf(f);
        return idx >= 0 ? (cols[idx] ?? "").trim() : "";
      };
      const businessDate = normalizeDate(get("businessDate"), defaultDateISO);
      const fullName = get("fullName");
      const phoneNumber = get("phoneNumber");
      const address = get("address");
      const orderType = get("orderType");
      const docketNumber = get("docketNumber");
      const quantity = get("quantity");
      const unitPrice = get("unitPrice");
      const qn = toAmount(quantity);
      const pn = toAmount(unitPrice);
      const amount = Math.round((qn * pn + Number.EPSILON) * 100) / 100;
      const phoneValid = !phoneNumber || normalizeIndianPhone(phoneNumber) !== null;
      const complete = Boolean(
        fullName && phoneNumber && phoneValid && address && orderType && docketNumber && qn >= 1 && pn > 0
      );
      return { businessDate, fullName, phoneNumber, address, orderType, docketNumber, quantity, unitPrice, amount, complete, phoneValid };
    });
  }, [dataRows, mapping, defaultDateISO]);

  const invalidPhones = mapped.filter((m) => !m.phoneValid).length;
  const incomplete = mapped.filter((m) => !m.complete).length;
  const totalAmount = Math.round((mapped.reduce((s, m) => s + m.amount, 0) + Number.EPSILON) * 100) / 100;

  async function commit() {
    if (!mapped.length) return;
    if (!importIdRef.current) {
      importIdRef.current =
        (crypto.randomUUID?.() ?? `imp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    }
    setImporting(true);
    try {
      const rows = mapped.map((m) => ({
        businessDate: m.businessDate,
        fullName: m.fullName,
        phoneNumber: m.phoneNumber,
        address: m.address,
        orderType: m.orderType,
        docketNumber: m.docketNumber,
        quantity: m.quantity,
        unitPrice: m.unitPrice,
      }));
      const res = await api.bulkImport(importIdRef.current, rows);
      toast({
        variant: "success",
        title: `${res.created} record(s) imported`,
        description: res.idempotent ? "This import was already processed." : "Records added to the register.",
      });
      onImported(res.created);
      importIdRef.current = "";
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: e instanceof ApiError ? e.message : "Could not import records.",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          importIdRef.current = "";
          reset();
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Paste multiple records</DialogTitle>
          <DialogDescription>
            Paste rows copied from Excel / Google Sheets (tab-separated) or a
            CSV file. Review the column mapping and preview before importing.
          </DialogDescription>
        </DialogHeader>

        {table.length === 0 ? (
          <div className="space-y-3">
            <Label htmlFor="bulk-input" className="flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4" /> Paste data
            </Label>
            <Textarea
              id="bulk-input"
              value={raw}
              onChange={(e) => handlePaste(e.target.value)}
              placeholder={"Full Name\tPhone\tAddress\tOrder Type\tDocket\nRavi Patel\t9876543210\tRajkot\tFarsan\t1021"}
              className="min-h-[160px] font-mono text-xs"
            />
            <div className="flex items-center gap-3">
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4" />
                  Upload CSV / TSV
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile(f);
                    }}
                  />
                </label>
              </Button>
              <span className="text-xs text-muted-foreground">
                Addresses with commas are handled correctly (quoted CSV / TSV).
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => {
                    setHasHeader(e.target.checked);
                    if (table[0])
                      setMapping(
                        table[0].map((c) => (e.target.checked ? guessField(c) : "ignore"))
                      );
                  }}
                />
                First row is a header
              </label>
              <Button variant="ghost" size="sm" onClick={reset}>
                Clear & re-paste
              </Button>
            </div>

            {/* Column mapping */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {(table[0] ?? []).map((h, i) => (
                      <th key={i} className="border-b border-border p-2 text-left align-top">
                        <select
                          value={mapping[i] ?? "ignore"}
                          onChange={(e) => {
                            const next = [...mapping];
                            next[i] = e.target.value as Field;
                            setMapping(next);
                          }}
                          className="w-full rounded border border-input bg-card px-1.5 py-1 text-xs"
                        >
                          {Object.entries(FIELD_LABELS).map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                        {hasHeader && (
                          <div className="mt-1 truncate text-[10px] text-muted-foreground" title={h}>
                            {h}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.slice(0, 6).map((cols, r) => (
                    <tr key={r} className="odd:bg-background even:bg-muted/20">
                      {(table[0] ?? []).map((_, c) => (
                        <td key={c} className="border-b border-border/60 p-2 align-top">
                          <span className="line-clamp-2 break-words">{cols[c] ?? ""}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dataRows.length > 6 && (
              <p className="text-xs text-muted-foreground">
                Showing first 6 of {dataRows.length} rows.
              </p>
            )}

            {/* Summary */}
            <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-brand-navy dark:text-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {mapped.length} record(s) will be created
              </span>
              {totalAmount > 0 && (
                <span className="font-medium text-brand-navy dark:text-foreground">
                  Total: {formatINR(totalAmount)}
                </span>
              )}
              {incomplete > 0 && (
                <span className="flex items-center gap-1.5 text-warning-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  {incomplete} saved as draft (missing fields)
                </span>
              )}
              {invalidPhones > 0 && (
                <span className="flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {invalidPhones} invalid phone(s) kept as-is
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Default date for blank rows: {formatDisplayDate(defaultDateISO)}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={commit} disabled={!mapped.length || importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Import {mapped.length || ""} record(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
