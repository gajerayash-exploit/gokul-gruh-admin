import "server-only";
import type { Order, OrderItem, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit/service";
import {
  isoDateToStorage,
  storageToISODate,
  weekdayFromDate,
  todayISODate,
} from "@/lib/dates";
import { normalizeIndianPhone, isOrderComplete } from "@/lib/validation/order";
import type { OrderDTO, OrderListResult } from "@/types";

export class ConcurrencyError extends Error {
  current: OrderDTO;
  constructor(current: OrderDTO) {
    super("This record was modified in another session.");
    this.name = "ConcurrencyError";
    this.current = current;
  }
}

export function toDTO(o: Order & { items?: OrderItem[] }): OrderDTO {
  const iso = storageToISODate(o.businessDate);
  const items = (o.items ?? []).map((it) => {
    const itAmt = Math.round((it.quantity * it.unitPrice + Number.EPSILON) * 100) / 100;
    return {
      id: it.id,
      orderId: it.orderId,
      itemName: it.itemName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      amount: itAmt,
    };
  });

  let totalQty = o.quantity;
  let totalAmt = Math.round((o.quantity * o.unitPrice + Number.EPSILON) * 100) / 100;

  if (items.length > 0) {
    totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
    totalAmt = Math.round((items.reduce((sum, it) => sum + it.amount, 0) + Number.EPSILON) * 100) / 100;
  }

  const orderType =
    o.orderType ||
    (items.length > 0
      ? items.map((it) => (it.quantity > 1 ? `${it.itemName} (${it.quantity})` : it.itemName)).join(", ")
      : "");

  return {
    id: o.id,
    businessDate: iso,
    weekday: weekdayFromDate(o.businessDate),
    fullName: o.fullName,
    phoneNumber: o.phoneNumber,
    address: o.address,
    orderType,
    docketNumber: o.docketNumber,
    quantity: totalQty,
    unitPrice: o.unitPrice,
    amount: totalAmt,
    items,
    status: o.status,
    version: o.version,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    deletedAt: o.deletedAt ? o.deletedAt.toISOString() : null,
  };
}

export async function getOrder(id: string): Promise<OrderDTO | null> {
  const o = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  return o ? toDTO(o) : null;
}

export async function createDraft(
  adminId: string,
  businessDate?: string,
  initialItemName?: string
): Promise<OrderDTO> {
  const iso = businessDate ?? todayISODate();
  const o = await prisma.order.create({
    data: {
      businessDate: isoDateToStorage(iso),
      status: "DRAFT",
      createdById: adminId,
      updatedById: adminId,
      ...(initialItemName
        ? {
            items: {
              create: {
                itemName: initialItemName,
                quantity: 1,
                unitPrice: 0,
              },
            },
          }
        : {}),
    },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  await logAudit({
    action: "ORDER_CREATED",
    entityType: "order",
    entityId: o.id,
    summary: `Draft created for ${iso}`,
    actorId: adminId,
  });
  return toDTO(o);
}

export interface OrderPatch {
  businessDate?: string;
  fullName?: string;
  phoneNumber?: string;
  address?: string;
  orderType?: string;
  docketNumber?: string;
  quantity?: number;
  unitPrice?: number;
  /** When true, validate + mark COMPLETE (normalizing phone). */
  finalize?: boolean;
}

/**
 * Update an order with optimistic concurrency control. If expectedVersion is
 * supplied and no longer matches, a ConcurrencyError is thrown carrying the
 * current server state (so the UI can reconcile rather than clobber).
 */
export async function updateOrder(
  id: string,
  patch: OrderPatch,
  adminId: string,
  expectedVersion?: number
): Promise<OrderDTO> {
  const existing = await prisma.order.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new Error("Order not found");

  const data: Prisma.OrderUpdateInput = { updatedBy: { connect: { id: adminId } } };
  if (patch.businessDate !== undefined)
    data.businessDate = isoDateToStorage(patch.businessDate);
  if (patch.fullName !== undefined) data.fullName = patch.fullName;
  if (patch.phoneNumber !== undefined) data.phoneNumber = patch.phoneNumber;
  if (patch.address !== undefined) data.address = patch.address;
  if (patch.orderType !== undefined) data.orderType = patch.orderType;
  if (patch.docketNumber !== undefined) data.docketNumber = patch.docketNumber;
  if (patch.quantity !== undefined) data.quantity = patch.quantity;
  if (patch.unitPrice !== undefined) data.unitPrice = patch.unitPrice;

  // Merge to evaluate completeness / finalization.
  const merged = {
    fullName: patch.fullName ?? existing.fullName,
    phoneNumber: patch.phoneNumber ?? existing.phoneNumber,
    address: patch.address ?? existing.address,
    orderType: patch.orderType ?? existing.orderType,
    docketNumber: patch.docketNumber ?? existing.docketNumber,
    quantity: patch.quantity ?? existing.quantity,
    unitPrice: patch.unitPrice ?? existing.unitPrice,
  };

  if (patch.finalize) {
    if (!isOrderComplete(merged)) {
      throw new Error("Cannot finalize: required fields are missing or invalid.");
    }
    // Normalize phone on finalize.
    const normalized = normalizeIndianPhone(merged.phoneNumber);
    if (normalized) data.phoneNumber = normalized;
    data.status = "COMPLETE";
  }

  data.version = { increment: 1 };

  // Optimistic concurrency: scope the update by version when provided.
  if (expectedVersion !== undefined) {
    const res = await prisma.order.updateMany({
      where: { id, version: expectedVersion, deletedAt: null },
      data: {
        ...(patch.businessDate !== undefined && {
          businessDate: isoDateToStorage(patch.businessDate),
        }),
        ...(patch.fullName !== undefined && { fullName: patch.fullName }),
        ...(patch.phoneNumber !== undefined && {
          phoneNumber:
            patch.finalize && normalizeIndianPhone(merged.phoneNumber)
              ? (normalizeIndianPhone(merged.phoneNumber) as string)
              : patch.phoneNumber,
        }),
        ...(patch.address !== undefined && { address: patch.address }),
        ...(patch.orderType !== undefined && { orderType: patch.orderType }),
        ...(patch.docketNumber !== undefined && { docketNumber: patch.docketNumber }),
        ...(patch.quantity !== undefined && { quantity: patch.quantity }),
        ...(patch.unitPrice !== undefined && { unitPrice: patch.unitPrice }),
        ...(patch.finalize && { status: "COMPLETE" }),
        updatedById: adminId,
        version: { increment: 1 },
      },
    });
    if (res.count === 0) {
      const current = await prisma.order.findUnique({ where: { id } });
      if (current) throw new ConcurrencyError(toDTO(current));
      throw new Error("Order not found");
    }
  } else {
    await prisma.order.update({ where: { id }, data });
  }

  const updated = await prisma.order.findUnique({
    where: { id },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (patch.finalize) {
    await logAudit({
      action: "ORDER_FINALIZED",
      entityType: "order",
      entityId: id,
      summary: `Order finalized (docket ${updated?.docketNumber ?? ""})`,
      actorId: adminId,
    });
  } else {
    await logAudit({
      action: "ORDER_UPDATED",
      entityType: "order",
      entityId: id,
      summary: "Order autosaved",
      metadata: { fields: Object.keys(patch).filter((k) => k !== "finalize") },
      actorId: adminId,
    });
  }
  return toDTO(updated!);
}

export async function softDeleteOrder(id: string, adminId: string): Promise<void> {
  const existing = await prisma.order.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new Error("Order not found");
  await prisma.order.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: adminId, version: { increment: 1 } },
  });
  await logAudit({
    action: "ORDER_DELETED",
    entityType: "order",
    entityId: id,
    summary: `Order deleted (docket ${existing.docketNumber || "—"}, ${existing.fullName || "unnamed"})`,
    actorId: adminId,
  });
}

export async function restoreOrder(id: string, adminId: string): Promise<OrderDTO> {
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) throw new Error("Order not found");
  await prisma.order.update({
    where: { id },
    data: { deletedAt: null, updatedById: adminId, version: { increment: 1 } },
  });
  await logAudit({
    action: "ORDER_RESTORED",
    entityType: "order",
    entityId: id,
    summary: "Order restored",
    actorId: adminId,
  });
  return (await getOrder(id))!;
}

export async function countForDate(iso: string): Promise<number> {
  const start = isoDateToStorage(iso);
  // businessDate is stored at 12:00:00Z of the day; match exact day window.
  const dayStart = new Date(`${iso}T00:00:00.000Z`);
  const dayEnd = new Date(`${iso}T23:59:59.999Z`);
  void start;
  return prisma.order.count({
    where: { businessDate: { gte: dayStart, lte: dayEnd }, deletedAt: null },
  });
}

export interface TodaySummary {
  todayISO: string;
  totalToday: number;
  draftsToday: number;
  completeToday: number;
  lastSavedAt: string | null;
}

export async function getTodaySummary(): Promise<TodaySummary> {
  const iso = todayISODate();
  const dayStart = new Date(`${iso}T00:00:00.000Z`);
  const dayEnd = new Date(`${iso}T23:59:59.999Z`);
  const where = { businessDate: { gte: dayStart, lte: dayEnd }, deletedAt: null };
  const [total, drafts, complete, last] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, status: "DRAFT" } }),
    prisma.order.count({ where: { ...where, status: "COMPLETE" } }),
    prisma.order.findFirst({
      where: { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);
  return {
    todayISO: iso,
    totalToday: total,
    draftsToday: drafts,
    completeToday: complete,
    lastSavedAt: last ? last.updatedAt.toISOString() : null,
  };
}

export interface ListFilters {
  dateISO?: string; // exact day
  fromISO?: string; // range start
  toISO?: string; // range end
  search?: string; // free text (name/phone/docket/type/address)
  status?: "DRAFT" | "COMPLETE";
  sortBy?: "businessDate" | "fullName" | "docketNumber" | "updatedAt";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export async function listOrders(filters: ListFilters): Promise<OrderListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));

  const where: Prisma.OrderWhereInput = {};
  if (!filters.includeDeleted) where.deletedAt = null;

  if (filters.dateISO) {
    where.businessDate = {
      gte: new Date(`${filters.dateISO}T00:00:00.000Z`),
      lte: new Date(`${filters.dateISO}T23:59:59.999Z`),
    };
  } else if (filters.fromISO || filters.toISO) {
    where.businessDate = {};
    if (filters.fromISO)
      (where.businessDate as Prisma.DateTimeFilter).gte = new Date(
        `${filters.fromISO}T00:00:00.000Z`
      );
    if (filters.toISO)
      (where.businessDate as Prisma.DateTimeFilter).lte = new Date(
        `${filters.toISO}T23:59:59.999Z`
      );
  }

  if (filters.status) where.status = filters.status;

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { fullName: { contains: q } },
      { phoneNumber: { contains: q } },
      { docketNumber: { contains: q } },
      { orderType: { contains: q } },
      { address: { contains: q } },
    ];
  }

  const sortBy = filters.sortBy ?? "businessDate";
  const sortDir = filters.sortDir ?? "desc";
  const orderBy: Prisma.OrderOrderByWithRelationInput[] =
    sortBy === "businessDate"
      ? [{ businessDate: sortDir }, { createdAt: sortDir }]
      : [{ [sortBy]: sortDir } as Prisma.OrderOrderByWithRelationInput];

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders: rows.map(toDTO), total, page, pageSize };
}

/** Find non-deleted orders sharing a docket number (for duplicate warnings). */
export async function findByDocket(
  docket: string,
  excludeId?: string
): Promise<OrderDTO[]> {
  const trimmed = docket.trim();
  if (!trimmed) return [];
  const rows = await prisma.order.findMany({
    where: {
      docketNumber: trimmed,
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  return rows.map(toDTO);
}

export interface BulkRow {
  businessDate: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  orderType: string;
  docketNumber: string;
  quantity: number;
  unitPrice: number;
}

export interface BulkResult {
  created: number;
}

/**
 * Create many orders in a single `createMany` statement (one round-trip
 * instead of one INSERT per row). A client-supplied importId (stored in
 * audit metadata) is used by the API layer to make retries idempotent and
 * avoid duplicate imports.
 */
export async function bulkCreate(
  rows: BulkRow[],
  adminId: string
): Promise<BulkResult> {
  const data = rows.map((r) => {
    const complete = isOrderComplete(r);
    const normalized = normalizeIndianPhone(r.phoneNumber);
    return {
      businessDate: isoDateToStorage(r.businessDate),
      fullName: r.fullName.trim(),
      phoneNumber: complete && normalized ? normalized : r.phoneNumber.trim(),
      address: r.address.trim(),
      orderType: r.orderType.trim(),
      docketNumber: r.docketNumber.trim(),
      quantity: Number.isFinite(r.quantity) && r.quantity > 0 ? Math.trunc(r.quantity) : 0,
      unitPrice: Number.isFinite(r.unitPrice) && r.unitPrice > 0 ? r.unitPrice : 0,
      status: (complete ? "COMPLETE" : "DRAFT") as "COMPLETE" | "DRAFT",
      createdById: adminId,
      updatedById: adminId,
    };
  });

  const { count } = await prisma.order.createMany({ data });

  await logAudit({
    action: "ORDER_BULK_IMPORT",
    entityType: "order",
    summary: `Bulk import of ${count} record(s)`,
    metadata: { count },
    actorId: adminId,
  });
  return { created: count };
}

export async function addOrderItem(
  orderId: string,
  item: { itemName: string; quantity: number; unitPrice: number },
  adminId: string
): Promise<OrderDTO> {
  const existing = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!existing) throw new Error("Order not found");

  await prisma.orderItem.create({
    data: {
      orderId,
      itemName: item.itemName.trim(),
      quantity: Math.max(1, item.quantity || 1),
      unitPrice: Math.max(0, item.unitPrice || 0),
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { updatedById: adminId, version: { increment: 1 } },
  });

  await logAudit({
    action: "ORDER_ITEM_ADDED",
    entityType: "order",
    entityId: orderId,
    summary: `Added item: ${item.itemName} (qty: ${item.quantity})`,
    actorId: adminId,
  });

  return (await getOrder(orderId))!;
}

export async function updateOrderItem(
  orderId: string,
  itemId: string,
  item: { itemName?: string; quantity?: number; unitPrice?: number },
  adminId: string
): Promise<OrderDTO> {
  const existing = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!existing) throw new Error("Order not found");

  const existingItem = await prisma.orderItem.findFirst({ where: { id: itemId, orderId } });
  if (!existingItem) throw new Error("Item not found");

  await prisma.orderItem.update({
    where: { id: itemId },
    data: {
      ...(item.itemName !== undefined && { itemName: item.itemName.trim() }),
      ...(item.quantity !== undefined && { quantity: Math.max(1, item.quantity) }),
      ...(item.unitPrice !== undefined && { unitPrice: Math.max(0, item.unitPrice) }),
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { updatedById: adminId, version: { increment: 1 } },
  });

  return (await getOrder(orderId))!;
}

export async function deleteOrderItem(
  orderId: string,
  itemId: string,
  adminId: string
): Promise<OrderDTO> {
  const existing = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!existing) throw new Error("Order not found");

  const existingItem = await prisma.orderItem.findFirst({ where: { id: itemId, orderId } });
  if (!existingItem) throw new Error("Item not found");

  await prisma.orderItem.delete({ where: { id: itemId } });

  await prisma.order.update({
    where: { id: orderId },
    data: { updatedById: adminId, version: { increment: 1 } },
  });

  await logAudit({
    action: "ORDER_ITEM_DELETED",
    entityType: "order",
    entityId: orderId,
    summary: `Deleted item: ${existingItem.itemName}`,
    actorId: adminId,
  });

  return (await getOrder(orderId))!;
}

