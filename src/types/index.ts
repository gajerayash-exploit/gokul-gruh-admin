import type { OrderStatus } from "@prisma/client";

export interface OrderItemDTO {
  id: string;
  orderId?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/** Order as sent to the client (dates as ISO strings, weekday derived). */
export interface OrderDTO {
  id: string;
  businessDate: string; // "YYYY-MM-DD" (Asia/Kolkata business day)
  weekday: string; // derived, never stored
  fullName: string;
  phoneNumber: string;
  address: string;
  orderType: string;
  docketNumber: string;
  /** Pricing. unitPrice is in rupees; amount = total of all items or quantity * unitPrice. */
  quantity: number;
  unitPrice: number;
  amount: number;
  items: OrderItemDTO[];
  status: OrderStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BusinessSettingsDTO {
  businessName: string;
  contactPerson: string;
  phoneNumber: string;
  address: string;
  mapsQuery: string;
  logoDataUrl: string;
  orderTypes: string[];
  defaultDateToday: boolean;
  updatedAt: string;
}

export interface AdminDTO {
  id: string;
  email: string;
  name: string;
}

export type SaveState = "idle" | "draft" | "saving" | "saved" | "error";

export interface OrderListResult {
  orders: OrderDTO[];
  total: number;
  page: number;
  pageSize: number;
}
