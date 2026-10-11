import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { BusinessSettingsDTO } from "@/types";
import { logAudit } from "@/lib/audit/service";

const DEFAULTS = {
  businessName: "Gokul Gruh Udhyog",
  contactPerson: "Kripal Dobariya",
  phoneNumber: "+91 9638412929",
  address: "",
  mapsQuery: "",
  logoDataUrl: "",
  orderTypes: "[]",
  defaultDateToday: true,
};

function parseOrderTypes(raw: string): string[] {
  try {
    const arr = JSON.parse(raw || "[]");
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
  } catch {
    /* ignore */
  }
  return [];
}

/** Fetch (and lazily create) the single business-settings row. */
export async function getSettings(): Promise<BusinessSettingsDTO> {
  let row = await prisma.businessSettings.findUnique({ where: { id: 1 } });
  if (!row) {
    row = await prisma.businessSettings.create({ data: { id: 1, ...DEFAULTS } });
  }
  return {
    businessName: row.businessName,
    contactPerson: row.contactPerson,
    phoneNumber: row.phoneNumber,
    address: row.address,
    mapsQuery: row.mapsQuery,
    logoDataUrl: row.logoDataUrl,
    orderTypes: parseOrderTypes(row.orderTypes),
    defaultDateToday: row.defaultDateToday,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface SettingsPatch {
  businessName?: string;
  contactPerson?: string;
  phoneNumber?: string;
  address?: string;
  mapsQuery?: string;
  logoDataUrl?: string;
  orderTypes?: string[];
  defaultDateToday?: boolean;
}

export async function updateSettings(
  patch: SettingsPatch,
  actorId: string | null
): Promise<BusinessSettingsDTO> {
  await getSettings(); // ensure row exists

  const data: Record<string, unknown> = {};
  if (patch.businessName !== undefined) data.businessName = patch.businessName.trim();
  if (patch.contactPerson !== undefined) data.contactPerson = patch.contactPerson.trim();
  if (patch.phoneNumber !== undefined) data.phoneNumber = patch.phoneNumber.trim();
  if (patch.address !== undefined) data.address = patch.address.trim();
  if (patch.mapsQuery !== undefined) data.mapsQuery = patch.mapsQuery.trim();
  if (patch.logoDataUrl !== undefined) data.logoDataUrl = patch.logoDataUrl;
  if (patch.orderTypes !== undefined)
    data.orderTypes = JSON.stringify(
      Array.from(new Set(patch.orderTypes.map((s) => s.trim()).filter(Boolean)))
    );
  if (patch.defaultDateToday !== undefined) data.defaultDateToday = patch.defaultDateToday;

  await prisma.businessSettings.update({ where: { id: 1 }, data });

  await logAudit({
    action: "SETTINGS_CHANGED",
    entityType: "settings",
    entityId: "1",
    summary: "Business settings updated",
    metadata: { fields: Object.keys(data).filter((k) => k !== "logoDataUrl") },
    actorId,
  });

  return getSettings();
}
