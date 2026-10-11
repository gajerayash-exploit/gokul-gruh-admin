"use client";

import * as React from "react";
import type { AdminDTO, BusinessSettingsDTO } from "@/types";
import { api } from "@/lib/api/client";

interface AppCtx {
  admin: AdminDTO;
  settings: BusinessSettingsDTO;
  refreshSettings: () => Promise<void>;
  setSettings: (s: BusinessSettingsDTO) => void;
}

const Ctx = React.createContext<AppCtx | null>(null);

export function AppProvider({
  admin,
  initialSettings,
  children,
}: {
  admin: AdminDTO;
  initialSettings: BusinessSettingsDTO;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = React.useState(initialSettings);

  const refreshSettings = React.useCallback(async () => {
    const { settings } = await api.getSettings();
    setSettings(settings);
  }, []);

  return (
    <Ctx.Provider value={{ admin, settings, refreshSettings, setSettings }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
