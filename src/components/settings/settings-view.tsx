"use client";

import * as React from "react";
import { Save, Loader2, Plus, X, Upload, Trash2, KeyRound, Image as ImageIcon } from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import { api, ApiError } from "@/lib/api/client";
import type { BusinessSettingsDTO } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/components/brand/logo";
import { toast } from "@/components/ui/use-toast";

// Downscale an uploaded image to a logo-sized PNG data URL.
async function fileToLogoDataUrl(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    const text = await file.text();
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  }
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Invalid image"));
      img.src = url;
    });
    const max = 256;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// __SETTINGS_BODY__
export function SettingsView() {
  const { settings, setSettings } = useApp();
  const [form, setForm] = React.useState<BusinessSettingsDTO>(settings);
  const [saving, setSaving] = React.useState(false);
  const [newType, setNewType] = React.useState("");

  function update<K extends keyof BusinessSettingsDTO>(key: K, value: BusinessSettingsDTO[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addType() {
    const t = newType.trim();
    if (!t || form.orderTypes.includes(t)) {
      setNewType("");
      return;
    }
    update("orderTypes", [...form.orderTypes, t]);
    setNewType("");
  }

  async function onLogo(file: File) {
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      if (dataUrl.length > 700_000) {
        toast({ variant: "destructive", title: "Image too large", description: "Please use a smaller image (~500KB max)." });
        return;
      }
      update("logoDataUrl", dataUrl);
    } catch {
      toast({ variant: "destructive", title: "Invalid image", description: "Could not read that file." });
    }
  }

  async function save() {
    setSaving(true);
    try {
      const { settings: updated } = await api.updateSettings({
        businessName: form.businessName,
        contactPerson: form.contactPerson,
        phoneNumber: form.phoneNumber,
        address: form.address,
        mapsQuery: form.mapsQuery,
        logoDataUrl: form.logoDataUrl,
        orderTypes: form.orderTypes,
        defaultDateToday: form.defaultDateToday,
      });
      setSettings(updated);
      setForm(updated);
      toast({ variant: "success", title: "Settings saved", description: "Business details updated everywhere." });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save", description: e instanceof ApiError ? e.message : "Please retry." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-brand-navy dark:text-foreground">Settings</h1>

      {/* Business identity */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-medium text-brand-navy dark:text-foreground">Business identity</h2>

        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-border bg-background">
            {form.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoDataUrl} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <LogoMark size={48} />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4" /> Upload logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onLogo(f);
                  }}
                />
              </label>
            </Button>
            {form.logoDataUrl && (
              <Button variant="ghost" className="text-destructive" onClick={() => update("logoDataUrl", "")}>
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            )}
            <p className="w-full text-xs text-muted-foreground">
              <ImageIcon className="mr-1 inline h-3.5 w-3.5" />
              PNG, JPEG, WEBP or SVG. Images are resized automatically. Leave empty to use the built-in emblem.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <Input value={form.businessName} onChange={(e) => update("businessName", e.target.value)} />
          </Field>
          <Field label="Contact person">
            <Input value={form.contactPerson} onChange={(e) => update("contactPerson", e.target.value)} />
          </Field>
          <Field label="Contact number">
            <Input value={form.phoneNumber} onChange={(e) => update("phoneNumber", e.target.value)} />
          </Field>
          <Field label="Google Maps location (address or lat,lng)">
            <Input
              value={form.mapsQuery}
              placeholder="e.g. Rajkot, Gujarat or 22.3039,70.8022"
              onChange={(e) => update("mapsQuery", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Business address">
          <Textarea
            value={form.address}
            placeholder="Street, area, city, state, PIN"
            onChange={(e) => update("address", e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Shown on the Contact page, order preview, downloaded image, and printed slip.
          </p>
        </Field>
      </section>

      {/* Order types */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-medium text-brand-navy dark:text-foreground">Frequently used order types</h2>
        <p className="text-xs text-muted-foreground">
          These appear as suggestions in the notebook. You can still type any new type while entering an order.
        </p>
        <div className="flex flex-wrap gap-2">
          {form.orderTypes.length === 0 && (
            <span className="text-sm text-muted-foreground">No order types yet.</span>
          )}
          {form.orderTypes.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-sm">
              {t}
              <button
                onClick={() => update("orderTypes", form.orderTypes.filter((x) => x !== t))}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${t}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newType}
            placeholder="Add an order type…"
            onChange={(e) => setNewType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addType();
              }
            }}
            className="max-w-xs"
          />
          <Button variant="outline" onClick={addType}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </section>

      {/* Preferences */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-medium text-brand-navy dark:text-foreground">Notebook preferences</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.defaultDateToday}
            onChange={(e) => update("defaultDateToday", e.target.checked)}
            className="h-4 w-4"
          />
          Default the notebook to today&apos;s date (Asia/Kolkata) on open
        </label>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </Button>
      </div>

      <PasswordSection />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PasswordSection() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function change() {
    if (next !== confirm) {
      toast({ variant: "destructive", title: "Passwords do not match" });
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast({ variant: "success", title: "Password changed" });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not change password", description: e instanceof ApiError ? e.message : "" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-medium text-brand-navy dark:text-foreground">
        <KeyRound className="h-4 w-4" /> Administrator password
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Current password">
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password">
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={change} disabled={saving || !current || !next}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Update password
        </Button>
      </div>
    </section>
  );
}
