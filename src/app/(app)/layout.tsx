import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/service";
import { AppProvider } from "@/components/providers/app-context";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const settings = await getSettings();

  return (
    <AppProvider admin={admin} initialSettings={settings}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
