import * as XLSX from "xlsx";
import type { OrderDTO } from "@/types";
import { formatDisplayDate, weekdayFromISO } from "@/lib/dates";

/**
 * Generate and download a formatted Microsoft Excel (.xlsx) spreadsheet
 * containing complete day details, itemized breakdown, and revenue totals.
 */
export async function exportDayOrdersToExcel(
  orders: OrderDTO[],
  dateISO: string,
  businessName = "Gokul Gruh Udhyog"
) {
  const displayDate = formatDisplayDate(dateISO);
  const weekday = weekdayFromISO(dateISO);

  // Build rows for the Excel worksheet
  const rows = orders.map((o, idx) => {
    // Compile item details
    const itemsText =
      o.items && o.items.length > 0
        ? o.items.map((it) => `${it.itemName} × ${it.quantity} (₹${it.unitPrice})`).join(", ")
        : o.orderType || "—";

    return {
      "S.No": idx + 1,
      "Order Date": displayDate,
      "Day": weekday,
      "Customer Name": o.fullName || "—",
      "Phone Number": o.phoneNumber || "—",
      "Delivery Address": o.address || "—",
      "Items / Sub-Entries": itemsText,
      "Total Qty": o.quantity,
      "Unit Price (₹)": o.unitPrice > 0 ? o.unitPrice : "—",
      "Total Amount (₹)": o.amount,
      "Docket Number": o.docketNumber || "—",
      "Status": o.status === "COMPLETE" ? "Completed" : "Draft",
    };
  });

  // Calculate day totals
  const totalQty = orders.reduce((s, o) => s + (o.quantity || 0), 0);
  const totalRevenue = orders.reduce((s, o) => s + (o.amount || 0), 0);
  const completedRevenue = orders
    .filter((o) => o.status === "COMPLETE")
    .reduce((s, o) => s + (o.amount || 0), 0);

  // Summary Row at the bottom
  rows.push({
    "S.No": "" as unknown as number,
    "Order Date": "TOTAL",
    "Day": "",
    "Customer Name": `${orders.length} Orders`,
    "Phone Number": "",
    "Delivery Address": "",
    "Items / Sub-Entries": "",
    "Total Qty": totalQty,
    "Unit Price (₹)": "",
    "Total Amount (₹)": totalRevenue,
    "Docket Number": `Completed: ₹${completedRevenue}`,
    "Status": "",
  });

  // Create worksheet and workbook
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths for readability in Excel
  worksheet["!cols"] = [
    { wch: 6 },  // S.No
    { wch: 12 }, // Date
    { wch: 12 }, // Day
    { wch: 22 }, // Customer Name
    { wch: 15 }, // Phone Number
    { wch: 35 }, // Address
    { wch: 32 }, // Items
    { wch: 10 }, // Qty
    { wch: 14 }, // Unit Price
    { wch: 16 }, // Total Amount
    { wch: 16 }, // Docket
    { wch: 12 }, // Status
  ];

  const workbook = XLSX.utils.book_new();
  const sheetName = `Orders ${displayDate.replace(/\//g, "-")}`;
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  // Generate buffer
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const fileName = `Gokul_Gruh_Orders_${displayDate.replace(/\//g, "-")}.xlsx`;

  // On modern mobile devices, allow direct WhatsApp / file sharing if supported
  if (
    typeof navigator !== "undefined" &&
    navigator.canShare &&
    navigator.canShare({ files: [new File([blob], fileName, { type: blob.type })] })
  ) {
    try {
      const file = new File([blob], fileName, { type: blob.type });
      await navigator.share({
        title: `${businessName} Orders - ${displayDate}`,
        text: `Customer Order Register for ${displayDate} (${weekday}) - Total Revenue: ₹${totalRevenue.toLocaleString("en-IN")}`,
        files: [file],
      });
      return;
    } catch (e) {
      // Fallback to normal download if share was cancelled or failed
    }
  }

  // Standard web/mobile browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
