import type {
  AdminDTO,
  BusinessSettingsDTO,
  OrderDTO,
  OrderListResult,
} from "@/types";
import type { ListFilters } from "@/lib/orders/service";

export class ApiError extends Error {
  status: number;
  conflict?: boolean;
  current?: OrderDTO;
  constructor(message: string, status: number, extra?: { conflict?: boolean; current?: OrderDTO }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.conflict = extra?.conflict;
    this.current = extra?.current;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, {
      conflict: data.conflict,
      current: data.current,
    });
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ admin: AdminDTO }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ admin: AdminDTO }>("/api/me"),

  summary: () =>
    request<{
      todayISO: string;
      totalToday: number;
      draftsToday: number;
      completeToday: number;
      lastSavedAt: string | null;
    }>("/api/summary"),

  listOrders: (filters: Partial<ListFilters>) => {
    const sp = new URLSearchParams();
    if (filters.dateISO) sp.set("date", filters.dateISO);
    if (filters.fromISO) sp.set("from", filters.fromISO);
    if (filters.toISO) sp.set("to", filters.toISO);
    if (filters.search) sp.set("q", filters.search);
    if (filters.status) sp.set("status", filters.status);
    if (filters.sortBy) sp.set("sortBy", filters.sortBy);
    if (filters.sortDir) sp.set("sortDir", filters.sortDir);
    if (filters.page) sp.set("page", String(filters.page));
    if (filters.pageSize) sp.set("pageSize", String(filters.pageSize));
    return request<OrderListResult>(`/api/orders?${sp.toString()}`);
  },

  createDraft: (businessDate?: string) =>
    request<{ order: OrderDTO }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({ businessDate }),
    }),

  updateOrder: (
    id: string,
    patch: Record<string, unknown>,
    expectedVersion?: number
  ) =>
    request<{ order: OrderDTO }>(`/api/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, expectedVersion }),
    }),

  deleteOrder: (id: string) =>
    request<{ ok: true }>(`/api/orders/${id}`, { method: "DELETE" }),

  restoreOrder: (id: string) =>
    request<{ order: OrderDTO }>(`/api/orders/${id}/restore`, { method: "POST" }),

  getOrder: (id: string) => request<{ order: OrderDTO }>(`/api/orders/${id}`),

  checkDuplicates: (docket: string, excludeId?: string) => {
    const sp = new URLSearchParams({ docket });
    if (excludeId) sp.set("excludeId", excludeId);
    return request<{ matches: OrderDTO[] }>(`/api/orders/duplicates?${sp.toString()}`);
  },

  bulkImport: (importId: string, rows: unknown[]) =>
    request<{ created: number; idempotent?: boolean }>(
      "/api/orders/bulk",
      { method: "POST", body: JSON.stringify({ importId, rows }) }
    ),

  getSettings: () => request<{ settings: BusinessSettingsDTO }>("/api/settings"),
  updateSettings: (patch: Partial<BusinessSettingsDTO>) =>
    request<{ settings: BusinessSettingsDTO }>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>("/api/admin/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};
