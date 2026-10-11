"use client";

import * as React from "react";
import { api, ApiError } from "@/lib/api/client";
import type { OrderDTO, SaveState } from "@/types";
import { weekdayFromISO } from "@/lib/dates";
import { missingRequiredFields, normalizeIndianPhone } from "@/lib/validation/order";
import { toAmount, round2 } from "@/lib/utils";

export type EditableField =
  | "businessDate"
  | "fullName"
  | "phoneNumber"
  | "address"
  | "orderType"
  | "docketNumber"
  | "quantity"
  | "unitPrice";

interface Fields {
  businessDate: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  orderType: string;
  docketNumber: string;
  quantity: string;
  unitPrice: string;
}

function pick(o: OrderDTO): Fields {
  return {
    businessDate: o.businessDate,
    fullName: o.fullName,
    phoneNumber: o.phoneNumber,
    address: o.address,
    orderType: o.orderType,
    docketNumber: o.docketNumber,
    quantity: o.quantity ? String(o.quantity) : "",
    unitPrice: o.unitPrice ? String(o.unitPrice) : "",
  };
}

const DEBOUNCE_MS = 650;

/**
 * Per-order autosave with debounce, optimistic concurrency, retry, and
 * conflict reconciliation. The "Saved" state is only shown AFTER the server
 * confirms persistence (never optimistically). Pending edits are flushed on
 * unmount / page hide so navigation does not silently drop work.
 */
export function useAutosave(
  initial: OrderDTO,
  opts?: {
    onSaved?: (o: OrderDTO) => void;
    onConflict?: (server: OrderDTO) => void;
  }
) {
  const [fields, setFields] = React.useState<Fields>(() => pick(initial));
  const [saveState, setSaveState] = React.useState<SaveState>(() =>
    initial.status === "COMPLETE" ? "saved" : "draft"
  );
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(
    initial.updatedAt
  );
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const versionRef = React.useRef(initial.version);
  const idRef = React.useRef(initial.id);
  const dirtyRef = React.useRef<Partial<Fields>>({});
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = React.useRef(false);
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  // Keep in sync if the parent swaps in a newer server version (e.g. reconcile).
  React.useEffect(() => {
    idRef.current = initial.id;
  }, [initial.id]);

  const doSave = React.useCallback(async () => {
    if (inFlightRef.current) return;
    const patch = dirtyRef.current;
    if (Object.keys(patch).length === 0) return;

    inFlightRef.current = true;
    dirtyRef.current = {};
    setSaveState("saving");
    setErrorMsg(null);

    try {
      const { order } = await api.updateOrder(
        idRef.current,
        patch,
        versionRef.current
      );
      versionRef.current = order.version;
      setLastSavedAt(order.updatedAt);
      // If more edits arrived while saving, keep saving; else mark saved.
      if (Object.keys(dirtyRef.current).length > 0) {
        setSaveState("saving");
        void doSave();
      } else {
        setSaveState("saved");
        optsRef.current?.onSaved?.(order);
      }
    } catch (err) {
      // Re-queue the patch so a retry re-sends it.
      dirtyRef.current = { ...patch, ...dirtyRef.current };
      if (err instanceof ApiError && err.status === 409 && err.current) {
        versionRef.current = err.current.version;
        setSaveState("error");
        setErrorMsg(
          "This record was changed elsewhere. Review before overwriting."
        );
        optsRef.current?.onConflict?.(err.current);
      } else {
        setSaveState("error");
        setErrorMsg(
          err instanceof ApiError ? err.message : "Save failed. Will retry."
        );
        // Automatic retry after a short delay.
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void doSave(), 4000);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const scheduleSave = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void doSave(), DEBOUNCE_MS);
  }, [doSave]);

  const setField = React.useCallback(
    (field: EditableField, value: string) => {
      setFields((prev) => ({ ...prev, [field]: value }));
      dirtyRef.current[field] = value;
      setSaveState("draft");
      scheduleSave();
    },
    [scheduleSave]
  );

  const flush = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (Object.keys(dirtyRef.current).length > 0) void doSave();
  }, [doSave]);

  const retry = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void doSave();
  }, [doSave]);

  // Reconcile with a server version (used on conflict acceptance).
  const reconcile = React.useCallback((server: OrderDTO) => {
    versionRef.current = server.version;
    dirtyRef.current = {};
    setFields(pick(server));
    setSaveState("saved");
    setLastSavedAt(server.updatedAt);
    setErrorMsg(null);
  }, []);

  // Flush pending edits when the tab is hidden or the component unmounts.
  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (timerRef.current) clearTimeout(timerRef.current);
      // best-effort flush on unmount
      if (Object.keys(dirtyRef.current).length > 0) void doSave();
    };
  }, [flush, doSave]);

  const missing = missingRequiredFields(fields);
  const isComplete = missing.length === 0;
  const weekday = weekdayFromISO(fields.businessDate);
  const phoneValid =
    !fields.phoneNumber || normalizeIndianPhone(fields.phoneNumber) !== null;
  const quantityNum = toAmount(fields.quantity);
  const unitPriceNum = toAmount(fields.unitPrice);
  const amount = round2(quantityNum * unitPriceNum);

  return {
    fields,
    setField,
    saveState,
    lastSavedAt,
    errorMsg,
    retry,
    flush,
    reconcile,
    missing,
    isComplete,
    weekday,
    phoneValid,
    amount,
    version: versionRef,
  };
}
