"use client";

import * as React from "react";
import {
  Camera,
  X,
  Flashlight,
  FlashlightOff,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ScanLine,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

export interface DocketScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanned: (docketNumber: string) => void;
  customerName?: string;
}

export function DocketScannerDialog({
  open,
  onOpenChange,
  onScanned,
  customerName,
}: DocketScannerDialogProps) {
  const [scanning, setScanning] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [torchOn, setTorchOn] = React.useState(false);
  const [hasTorch, setHasTorch] = React.useState(false);
  const [detectedValue, setDetectedValue] = React.useState<string | null>(null);
  const [fileScanning, setFileScanning] = React.useState(false);
  const [manualInput, setManualInput] = React.useState("");

  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const readerElementId = "docket-camera-reader";
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Synthesize a clean checkout beep using Web Audio API
  const playBeep = React.useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio not permitted or not supported
    }
  }, []);

  const handleSuccessfulScan = React.useCallback(
    (decodedText: string) => {
      // Clean scanned text (drop leading/trailing quotes, spaces, url wrappers)
      let cleaned = decodedText.trim();
      // If it's a URL, extract the trailing path or query parameter
      if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
        try {
          const url = new URL(cleaned);
          const docketParam = url.searchParams.get("docket") || url.searchParams.get("tracking") || url.searchParams.get("id");
          if (docketParam) {
            cleaned = docketParam;
          } else {
            const parts = url.pathname.split("/").filter(Boolean);
            if (parts.length > 0) cleaned = parts[parts.length - 1];
          }
        } catch {
          // ignore url parse error
        }
      }

      playBeep();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([60, 40, 60]);
      }

      setDetectedValue(cleaned);
      onScanned(cleaned);

      toast({
        variant: "success",
        title: "Docket Scanned!",
        description: `Detected: ${cleaned}`,
      });

      // Stop camera and close after short visual confirmation
      setTimeout(() => {
        stopCamera();
        onOpenChange(false);
      }, 400);
    },
    [playBeep, onScanned, onOpenChange]
  );

  const startCamera = React.useCallback(async () => {
    setCameraError(null);
    setDetectedValue(null);
    setScanning(true);

    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // ignore
        }
      }

      const html5QrCode = new Html5Qrcode(readerElementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      scannerRef.current = html5QrCode;

      const config = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
          width: Math.min(Math.floor(viewfinderWidth * 0.9), 320),
          height: Math.min(Math.floor(viewfinderHeight * 0.55), 160),
        }),
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: { exact: "environment" } },
        config,
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // Frame scan pass
        }
      ).catch(async () => {
        // Fallback without exact: environment if device has single or virtual camera
        if (scannerRef.current) {
          await scannerRef.current.start(
            { facingMode: "environment" },
            config,
            (decodedText) => handleSuccessfulScan(decodedText),
            () => {}
          );
        }
      });

      // Check for torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && "torch" in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      console.error("Camera scan error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowedError")) {
        setCameraError("Camera permission was denied. Please allow camera access in browser settings, or upload a photo of the docket.");
      } else if (msg.includes("NotFound") || msg.includes("DevicesNotFoundError")) {
        setCameraError("No camera found on this device. You can upload an image of the docket barcode instead.");
      } else {
        setCameraError("Could not start camera. Please ensure camera is not in use by another app, or try uploading a photo.");
      }
      setScanning(false);
    }
  }, [handleSuccessfulScan]);

  const stopCamera = React.useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.warn("Error stopping scanner", e);
      }
      scannerRef.current = null;
    }
    setScanning(false);
    setTorchOn(false);
  }, []);

  // Toggle flashlight on mobile
  async function toggleTorch() {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn("Torch error", e);
    }
  }

  // Handle Photo upload scanning
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileScanning(true);
    setCameraError(null);
    try {
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(readerElementId, false);
      }
      const result = await scanner.scanFile(file, true);
      handleSuccessfulScan(result);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No Barcode/QR Detected",
        description: "Could not find a readable barcode or QR code in that image. Please try again with clear lighting.",
      });
    } finally {
      setFileScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Start scanning on open, clean up on close
  React.useEffect(() => {
    if (open) {
      // Small delay to ensure DOM element #docket-camera-reader is mounted
      const timer = setTimeout(() => {
        void startCamera();
      }, 250);
      return () => clearTimeout(timer);
    } else {
      void stopCamera();
    }
  }, [open, startCamera, stopCamera]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) void stopCamera();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-border">
        {/* Header */}
        <div className="bg-primary/5 border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-2xs">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Scan Docket Barcode / QR
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {customerName ? `Scanning for ${customerName}` : "Point camera at docket barcode on slip"}
              </DialogDescription>
            </div>
          </div>
          {hasTorch && scanning && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleTorch}
              className="h-8 gap-1 text-xs"
            >
              {torchOn ? <FlashlightOff className="h-3.5 w-3.5 text-amber-500" /> : <Flashlight className="h-3.5 w-3.5" />}
              <span>{torchOn ? "Flash Off" : "Flash"}</span>
            </Button>
          )}
        </div>

        {/* Camera Viewport */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[260px] max-h-[55vh] overflow-hidden">
          <style>{`
            #docket-camera-reader video {
              width: 100% !important;
              height: 100% !important;
              max-height: 50vh !important;
              object-fit: cover !important;
            }
            #docket-camera-reader {
              width: 100% !important;
              border: none !important;
            }
            #docket-camera-reader img {
              display: none !important;
            }
          `}</style>
          {/* HTML5 QR Container */}
          <div id={readerElementId} className="w-full max-w-full overflow-hidden" />

          {/* Aiming Reticle / Laser Overlay */}
          {scanning && !cameraError && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="relative h-44 w-72 rounded-xl border-2 border-primary/70 shadow-2xl overflow-hidden">
                {/* Corner markers */}
                <span className="absolute top-0 left-0 h-4 w-4 border-t-4 border-l-4 border-primary" />
                <span className="absolute top-0 right-0 h-4 w-4 border-t-4 border-r-4 border-primary" />
                <span className="absolute bottom-0 left-0 h-4 w-4 border-b-4 border-l-4 border-primary" />
                <span className="absolute bottom-0 right-0 h-4 w-4 border-b-4 border-r-4 border-primary" />

                {/* Animated laser scan line */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse shadow-[0_0_12px_#3b82f6]" />

                <div className="absolute inset-x-0 bottom-2 text-center">
                  <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                    Align Barcode or QR Here
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Success Detected Overlay */}
          {detectedValue && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 animate-fade-in">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-2 animate-bounce" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Docket Detected
              </span>
              <span className="text-xl font-bold tracking-widest my-1">{detectedValue}</span>
              <span className="text-xs text-emerald-200">Applying to order...</span>
            </div>
          )}

          {/* Camera Error / Fallback State */}
          {cameraError && (
            <div className="absolute inset-0 bg-card p-6 flex flex-col items-center justify-center text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-amber-500" />
              <p className="text-xs text-muted-foreground max-w-xs">{cameraError}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={startCamera}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry Camera
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileScanning}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" /> Upload Photo
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input for photo upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
        />

        {/* Footer Actions with Manual Input fallback */}
        <div className="bg-card border-t border-border p-3 px-4 flex flex-col gap-2.5">
          {/* Manual docket fallback */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Or type docket # manually…"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold outline-none focus:border-primary"
            />
            <Button
              type="button"
              size="sm"
              disabled={!manualInput.trim()}
              onClick={() => {
                if (manualInput.trim()) {
                  handleSuccessfulScan(manualInput.trim());
                }
              }}
              className="h-8 px-3 text-xs font-bold"
            >
              Apply
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={fileScanning}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8"
            >
              {fileScanning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>Upload / Snap Photo</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void stopCamera();
                onOpenChange(false);
              }}
              className="text-xs h-8"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
