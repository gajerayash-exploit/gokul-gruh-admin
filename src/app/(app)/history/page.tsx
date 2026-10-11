import type { Metadata } from "next";
import { HistoryView } from "@/components/history/history-view";

export const metadata: Metadata = { title: "Order History — Gokul Gruh Udhyog" };

export default function HistoryPage() {
  return <HistoryView />;
}
