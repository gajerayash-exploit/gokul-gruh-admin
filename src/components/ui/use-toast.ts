"use client";

// Minimal toast store (adapted from the shadcn/ui pattern).
import * as React from "react";
import type { ToastProps } from "@/components/ui/toast";

type ToasterToast = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastProps["variant"];
  duration?: number;
};

const TOAST_LIMIT = 4;
const TOAST_REMOVE_DELAY = 5000;

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type State = { toasts: ToasterToast[] };
const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(toasts: ToasterToast[]) {
  memoryState = { toasts };
  listeners.forEach((l) => l(memoryState));
}

const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleRemove(id: string, duration: number) {
  if (timeouts.has(id)) return;
  const t = setTimeout(() => {
    timeouts.delete(id);
    dispatch(memoryState.toasts.filter((x) => x.id !== id));
  }, duration);
  timeouts.set(id, t);
}

export function toast(opts: Omit<ToasterToast, "id">) {
  const id = genId();
  const duration = opts.duration ?? TOAST_REMOVE_DELAY;
  const next = [{ ...opts, id }, ...memoryState.toasts].slice(0, TOAST_LIMIT);
  dispatch(next);
  scheduleRemove(id, duration);
  return id;
}

export function dismissToast(id: string) {
  dispatch(memoryState.toasts.filter((x) => x.id !== id));
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return { toasts: state.toasts, toast, dismiss: dismissToast };
}
