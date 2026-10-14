import * as React from "react";
import type { OrderDTO, BusinessSettingsDTO } from "@/types";
import { formatDisplayDate } from "@/lib/dates";
import { formatPhoneForDisplay, normalizeIndianPhone } from "@/lib/validation/order";
import { formatINR } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";

/**
 * Canonical 4x6 inch order slip / invoice. Rendered at exactly 384 x 576 CSS
 * px (= 4in x 6in at 96dpi), so the same component serves screen preview,
 * print (@page 4in 6in), and PNG export (pixelRatio 3.125 -> 1200 x 1800).
 *
 * Laid out as a proper invoice: branded header, boxed docket, bill-to block,
 * an itemised table (description / qty / rate / amount) and a payable total.
 * All structure is drawn with borders — never background fills — so it stays
 * legible on monochrome / thermal printers. The single hairline brand accent
 * is decorative and degrades gracefully to grey.
 */
export const SLIP_W = 384;
export const SLIP_H = 576;

const INK = "#0f172a";
const SUB = "#334155";
const MUTED = "#64748b";
const LINE = "#cbd5e1";
const HAIR = "#e2e8f0";
const BRAND = "#426BCE";



function phoneDisplay(raw: string): string {
  const n = normalizeIndianPhone(raw);
  return n ? formatPhoneForDisplay(n) : raw;
}

interface Props {
  order: OrderDTO;
  settings: BusinessSettingsDTO;
  /** Mark as the print surface (only ONE should be marked at a time). */
  printSurface?: boolean;
}

export const OrderSlip = React.forwardRef<HTMLDivElement, Props>(
  function OrderSlip({ order, settings, printSurface = false }, ref) {
    const recordRef = order.id.slice(-8).toUpperCase();
    return (
      <div
        ref={ref}
        {...(printSurface ? { "data-print-surface": "" } : {})}
        style={{
          width: SLIP_W,
          height: SLIP_H,
          background: "#ffffff",
          color: INK,
          fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
          boxSizing: "border-box",
          padding: 22,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ---------- Header: brand left, contact right ---------- */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {settings.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoDataUrl}
              alt=""
              style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 7, flexShrink: 0 }}
              crossOrigin="anonymous"
            />
          ) : (
            <LogoMark size={38} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.2, lineHeight: 1.05 }}>
              {settings.businessName}
            </div>
            <div style={{ marginTop: 3, fontSize: 8.5, color: MUTED, lineHeight: 1.4 }}>
              {settings.address ? (
                <div style={{ whiteSpace: "pre-line" }}>{settings.address}</div>
              ) : null}
              {settings.phoneNumber ? (
                <div style={{ color: SUB, fontWeight: 500 }}>Tel {settings.phoneNumber}</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Accent rule */}
        <div style={{ marginTop: 12, height: 2, background: BRAND, borderRadius: 2 }} />
        <div style={{ marginTop: 2, borderTop: `1px solid ${INK}` }} />

        {/* ---------- Title + Docket ---------- */}
        <div style={{ marginTop: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.4, color: INK, lineHeight: 1.1 }}>
              Customer Order Slip
            </div>
            <div style={{ marginTop: 3, fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.4, color: MUTED }}>
              Order Record
            </div>
          </div>
          <div
            style={{
              border: `1.5px solid ${INK}`,
              borderRadius: 9,
              padding: "5px 12px",
              textAlign: "right",
              minWidth: 118,
            }}
          >
            <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.4, color: MUTED }}>
              Docket No.
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: 0.5,
                fontVariantNumeric: "tabular-nums",
                wordBreak: "break-all",
              }}
            >
              {order.docketNumber || "—"}
            </div>
          </div>
        </div>

        {/* ---------- Date / Day ---------- */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <MetaCell label="Order Date" value={formatDisplayDate(order.businessDate)} />
          <div style={{ width: 1, background: LINE }} />
          <MetaCell
            label="Day"
            value={order.weekday || "—"}
          />
        </div>

        {/* ---------- Bill to ---------- */}
        <div
          style={{
            marginTop: 12,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <Row label="Customer Name" value={order.fullName || "—"} first />
          <Row label="Phone Number" value={order.phoneNumber ? phoneDisplay(order.phoneNumber) : "—"} />
          <Row label="Address" value={order.address || "—"} multiline />
        </div>

        {/* ---------- Items table ---------- */}
        <div
          style={{
            marginTop: 12,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {/* Column header */}
          <div style={{ display: "flex", borderBottom: `1.5px solid ${INK}` }}>
            <ItemHead label="Description" style={{ flex: 1, textAlign: "left" }} />
            <ItemHead label="Qty" style={{ width: 34, textAlign: "right" }} />
            <ItemHead label="Rate" style={{ width: 72, textAlign: "right" }} />
            <ItemHead label="Amount" style={{ width: 80, textAlign: "right" }} />
          </div>
          {/* Items rows: either multi-item sub-entries or legacy single entry */}
          {order.items && order.items.length > 0 ? (
            order.items.map((it, idx) => (
              <div
                key={it.id || idx}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  padding: "6px 10px",
                  borderBottom: idx < order.items.length - 1 ? `1px solid ${HAIR}` : "none",
                }}
              >
                <div style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: INK, lineHeight: 1.25, wordBreak: "break-word" }}>
                  {it.itemName || "—"}
                </div>
                <div style={{ width: 34, textAlign: "right", fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {it.quantity || "—"}
                </div>
                <div style={{ width: 72, textAlign: "right", fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {it.unitPrice ? formatINR(it.unitPrice) : "—"}
                </div>
                <div style={{ width: 80, textAlign: "right", fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {it.amount ? formatINR(it.amount) : "—"}
                </div>
              </div>
            ))
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", padding: "9px 10px" }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: INK, lineHeight: 1.3, wordBreak: "break-word" }}>
                {order.orderType || "—"}
              </div>
              <div style={{ width: 34, textAlign: "right", fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {order.quantity || "—"}
              </div>
              <div style={{ width: 72, textAlign: "right", fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {order.unitPrice ? formatINR(order.unitPrice) : "—"}
              </div>
              <div style={{ width: 80, textAlign: "right", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {order.amount ? formatINR(order.amount) : "—"}
              </div>
            </div>
          )}
          {/* Payable total */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "9px 12px",
              borderTop: `1.5px solid ${INK}`,
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: SUB }}>
              Amount Payable
            </span>
            <span style={{ fontSize: 20, fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" }}>
              {formatINR(order.amount || 0)}
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* ---------- Footer ---------- */}
        <div style={{ textAlign: "center", fontSize: 9.5, color: BRAND, fontWeight: 600 }}>
          Thank you for your order
        </div>
        <div
          style={{
            marginTop: 7,
            borderTop: `1px solid ${HAIR}`,
            paddingTop: 7,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 8,
            color: MUTED,
          }}
        >
          <span style={{ fontVariantNumeric: "tabular-nums", letterSpacing: 0.3 }}>REF {recordRef}</span>
          {settings.contactPerson ? <span>Prepared by {settings.contactPerson}</span> : <span />}
        </div>
      </div>
    );
  }
);

function ItemHead({ label, style }: { label: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: "6px 10px",
        fontSize: 7.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: MUTED,
        ...style,
      }}
    >
      {label}
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, padding: "7px 12px" }}>
      <div
        style={{
          fontSize: 7.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: MUTED,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, letterSpacing: 0.2 }}>{value}</div>
    </div>
  );
}

function Row({
  label,
  value,
  multiline,
  first,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  first?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        padding: "8px 12px",
        borderTop: first ? "none" : `1px solid ${HAIR}`,
      }}
    >
      <div
        style={{
          width: 92,
          flexShrink: 0,
          fontSize: 8,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: MUTED,
          lineHeight: 1.4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          fontSize: 12.5,
          fontWeight: 600,
          color: INK,
          lineHeight: 1.35,
          whiteSpace: multiline ? "pre-line" : "normal",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}
