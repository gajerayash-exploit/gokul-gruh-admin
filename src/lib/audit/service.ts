import "server-only";
import { prisma } from "@/lib/db/prisma";

interface AuditInput {
  action: string;
  entityType: "order" | "settings" | "auth";
  entityId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}

/**
 * Record an audit event. Audit history is append-only from the app's
 * perspective — there is no UI path to edit or delete these rows.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary ?? "",
        metadata: input.metadata ? JSON.stringify(input.metadata) : "",
        actorId: input.actorId ?? null,
      },
    });
  } catch (err) {
    // Never let audit logging break the main operation.
    console.error("[audit] failed to record event", err);
  }
}
