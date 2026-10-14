import { normalizeIndianPhone } from "@/lib/validation/order";
import { GOKUL_ITEMS } from "@/components/orders/items-scroll-list";

export interface ParsedCustomerDetails {
  fullName: string;
  phoneNumber: string;
  address: string;
  docketNumber: string;
  items: Array<{ itemName: string; quantity: number; unitPrice?: number }>;
  orderType: string;
  rawText: string;
  deliveryDateHint?: "today" | "tomorrow" | string;
}

/**
 * Intelligent parser that extracts customer name, Indian mobile number,
 * address, items, and docket number from raw unstructured text copied from
 * WhatsApp, SMS, Google Pay, notes, or messages.
 */
export function parseCustomerText(rawText: string): ParsedCustomerDetails {
  const clean = (rawText || "").trim();
  if (!clean) {
    return {
      fullName: "",
      phoneNumber: "",
      address: "",
      docketNumber: "",
      items: [],
      orderType: "",
      rawText: "",
    };
  }

  // Split into lines and strip WhatsApp timestamp prefixes like "[12:30 PM, 14/10/2026] Name: "
  const rawLines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const lines = rawLines.map((line) => {
    // Strip WhatsApp chat export timestamps: e.g. "14/10/26, 2:30 pm - " or "[14/10/26, 2:30:15 PM] "
    return line
      .replace(/^\[?\d{1,2}[/-]\d{1,2}[/-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]m)?\]?\s*(?:-\s*)?/i, "")
      .trim();
  }).filter(Boolean);

  let detectedPhone = "";
  let detectedDocket = "";
  const detectedItems: Array<{ itemName: string; quantity: number; unitPrice?: number }> = [];
  const remainingLines: string[] = [];

  // 1. Phone number extraction regex: captures Indian numbers with optional +91/0
  const phoneRegex = /(?:\+91[\s-]?)?(?:[6-9]\d{9}|[6-9]\d{4}[\s-]?\d{5}|[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4})/;

  // 2. Identify docket markers
  const docketRegex = /(?:docket|bill\s*(?:no\.?|#)?|slip\s*(?:no\.?|#)?|inv(?:oice)?\s*(?:no\.?|#)?|token\s*(?:no\.?|#)?)\s*[:#-]?\s*([a-zA-Z0-9_-]+)/i;

  // 3. Known item lookup map (lowercase -> item definition)
  const itemMap = new Map<string, typeof GOKUL_ITEMS[number]>();
  for (const it of GOKUL_ITEMS) {
    itemMap.set(it.name.toLowerCase(), it);
    itemMap.set(it.gujarati.toLowerCase(), it);
  }

  // Iterate lines to extract labeled info or recognizable patterns
  for (const line of lines) {
    // Check for docket
    const dockMatch = line.match(docketRegex);
    if (dockMatch && !detectedDocket) {
      detectedDocket = dockMatch[1].trim();
      continue;
    }

    // Check for explicit phone line (e.g. "Phone: 9825012345" or "Mo: 98250 12345")
    const phoneLabelMatch = line.match(/(?:phone|mobile|mo\.?|mob\.?|cell|contact|wa|whatsapp)\s*[:=-]?\s*([+0-9\s-]{10,15})/i);
    if (phoneLabelMatch && !detectedPhone) {
      const normalized = normalizeIndianPhone(phoneLabelMatch[1]);
      if (normalized) {
        detectedPhone = normalized;
        continue;
      }
    }

    // Check for phone number anywhere on the line
    if (!detectedPhone) {
      const pMatch = line.match(phoneRegex);
      if (pMatch) {
        const normalized = normalizeIndianPhone(pMatch[0]);
        if (normalized) {
          detectedPhone = normalized;
          // If the line only contained the phone number (or phone with label), skip it from address
          const cleanedLine = line.replace(pMatch[0], "").replace(/^(?:phone|mobile|mo\.?|mob\.?|cell|contact)[:\s-]*/i, "").trim();
          if (cleanedLine) {
            remainingLines.push(cleanedLine);
          }
          continue;
        }
      }
    }

    // Check for Item matches on this line (e.g. "Kothimba 2", "Bhinda 500g", "Guvar: 1kg")
    let lineMatchedItem = false;
    for (const [key, itemDef] of Array.from(itemMap.entries())) {
      const itemRegex = new RegExp(`(?:^|[\\s,;])(${key})(?:\\s*[:=-]?\\s*(\\d+(?:\\.\\d+)?))?(?:\\s*(?:kg|g|gm|packet|pkt|nos|pcs|box)?)?`, "i");
      const match = line.match(itemRegex);
      if (match) {
        const qtyVal = match[2] ? Math.max(1, Math.round(parseFloat(match[2]))) : 1;
        // Avoid duplicate items
        if (!detectedItems.some((di) => di.itemName === itemDef.name)) {
          detectedItems.push({
            itemName: itemDef.name,
            quantity: qtyVal,
            unitPrice: itemDef.defaultPrice || 0,
          });
        }
        lineMatchedItem = true;
      }
    }

    if (!lineMatchedItem) {
      remainingLines.push(line);
    }
  }

  // Now deduce Full Name vs Address from remainingLines
  let fullName = "";
  const addressParts: string[] = [];

  // Keywords that strongly hint at an address line
  const addressKeywords = /(?:flat|apt|apartment|block|bldg|building|society|soc|heights|residency|enclave|bungalow|plot|house|nagar|road|rd|street|marg|cross|near|opp|behind|beside|circle|chowk|station|highway|char\s*rasta|surat|ahmedabad|vadodara|baroda|rajkot|mumbai|gujarat|india|\b\d{6}\b)/i;
  // Keywords that hint at a name label
  const nameLabelRegex = /^(?:name|customer|client|cust|shree|mr\.?|mrs\.?)\s*[:=-]?\s*(.+)$/i;

  for (let i = 0; i < remainingLines.length; i++) {
    const line = remainingLines[i].trim();
    if (!line) continue;

    // Explicit name label
    const nameMatch = line.match(nameLabelRegex);
    if (nameMatch && !fullName) {
      fullName = nameMatch[1].trim();
      continue;
    }

    // Explicit address label
    const addrMatch = line.match(/^(?:address|add|addr|loc|location|delivery\s*to)\s*[:=-]?\s*(.+)$/i);
    if (addrMatch) {
      addressParts.push(addrMatch[1].trim());
      continue;
    }

    // If we haven't found a name yet:
    // If this line does NOT look like an address, is reasonably short (< 40 chars), and doesn't contain lots of digits, it's likely the customer's name!
    if (!fullName && !addressKeywords.test(line) && line.length <= 40 && !/\d{2,}/.test(line)) {
      fullName = line.replace(/^[#*-]\s*/, "");
      continue;
    }

    // Otherwise, treat as part of address
    addressParts.push(line);
  }

  // Fallback: If no name was found but there are address parts, if the first line is short, use it as name
  if (!fullName && addressParts.length > 1 && addressParts[0].length <= 35 && !/\d{3,}/.test(addressParts[0])) {
    fullName = addressParts.shift()!;
  }

  const finalAddress = addressParts.join(", ").replace(/,\s*,/g, ", ").trim();

  // If no items were parsed but order type can be inferred
  const orderType = detectedItems.length > 0 
    ? detectedItems.map((it) => it.itemName).join(", ") 
    : "";

  // Detect delivery date hints: "tomorrow", "kal", "next day", or explicit dates
  let deliveryDateHint: "today" | "tomorrow" | string | undefined = undefined;
  if (/(?:tomorrow|kal\b|kaal\b|next\s*day|deliv(?:er|ery)?\s*(?:tomorrow|kal))/i.test(clean)) {
    deliveryDateHint = "tomorrow";
  } else if (/(?:today|aaj\b|deliv(?:er|ery)?\s*(?:today|aaj))/i.test(clean)) {
    deliveryDateHint = "today";
  }

  return {
    fullName: fullName.replace(/^[,\s-]+|[,\s-]+$/g, ""),
    phoneNumber: detectedPhone,
    address: finalAddress,
    docketNumber: detectedDocket,
    items: detectedItems,
    orderType,
    rawText: clean,
    deliveryDateHint,
  };
}
