"use client";

import * as React from "react";
import { Phone, Copy, Check, MapPin, ExternalLink, Navigation, User } from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { toast } from "@/components/ui/use-toast";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export function ContactView() {
  const { settings } = useApp();
  const [copied, setCopied] = React.useState(false);

  const telHref = `tel:${settings.phoneNumber.replace(/[^\d+]/g, "")}`;
  const query = (settings.mapsQuery || settings.address || "").trim();
  const hasLocation = query.length > 0;
  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  const embedUrl =
    MAPS_KEY && hasLocation
      ? `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${encodeURIComponent(query)}`
      : "";

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(settings.phoneNumber);
      setCopied(true);
      toast({ variant: "success", title: "Number copied", description: settings.phoneNumber });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "Could not copy", description: "Copy the number manually." });
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero */}
      <div className="mb-6 flex flex-col items-start gap-4 rounded-2xl border border-border bg-gradient-to-br from-brand-soft/70 to-card p-6 dark:from-primary/10 sm:flex-row sm:items-center">
        <LogoMark size={56} />
        <div>
          <h1 className="text-2xl font-semibold text-brand-navy dark:text-foreground">
            {settings.businessName}
          </h1>
          <p className="text-sm text-muted-foreground">Get in touch with us</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Contact info */}
        <div className="space-y-4">
          <InfoCard icon={<User className="h-5 w-5" />} label="Contact Person" value={settings.contactPerson || "—"} />

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Phone className="h-4 w-4" /> Phone Number
            </div>
            <div className="text-lg font-semibold text-brand-navy dark:text-foreground">
              {settings.phoneNumber || "—"}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild>
                <a href={telHref}>
                  <Phone className="h-4 w-4" /> Call now
                </a>
              </Button>
              <Button variant="outline" onClick={copyNumber}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy number"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-4 w-4" /> Business Address
            </div>
            {settings.address ? (
              <p className="whitespace-pre-line text-sm text-brand-navy dark:text-foreground">
                {settings.address}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Business address not configured. Add it in{" "}
                <a href="/settings" className="text-primary underline-offset-2 hover:underline">
                  Settings
                </a>
                .
              </p>
            )}
            {hasLocation && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <a href={mapsSearchUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Open in Google Maps
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-4 w-4" /> Directions
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {embedUrl ? (
            <iframe
              title="Business location map"
              src={embedUrl}
              className="h-full min-h-[320px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-primary">
                <MapPin className="h-6 w-6" />
              </div>
              {hasLocation ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Interactive map needs a Google Maps API key. You can still open
                    the location in Google Maps.
                  </p>
                  <Button asChild>
                    <a href={mapsSearchUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" /> Open in Google Maps
                    </a>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Configure the business address or a map location in Settings to
                  show the map here.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-lg font-semibold text-brand-navy dark:text-foreground">{value}</div>
    </div>
  );
}
