import type { Metadata } from "next";
import { Notebook } from "@/components/notebook/notebook";

export const metadata: Metadata = { title: "Digital Notebook — Gokul Gruh Udhyog" };

export default function NotebookPage() {
  return <Notebook />;
}
