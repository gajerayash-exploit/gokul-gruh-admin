import type { Metadata } from "next";
import { ContactView } from "@/components/contact/contact-view";

export const metadata: Metadata = { title: "Contact Us — Gokul Gruh Udhyog" };

export default function ContactPage() {
  return <ContactView />;
}
