"use client";

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";

const icons = {
  success: <CheckCircle2 className="h-5 w-5 text-success" />,
  destructive: <XCircle className="h-5 w-5 text-destructive" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning" />,
  default: null,
};

export function Toaster() {
  const { toasts } = useToast();
  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, title, description, variant }) => (
        <Toast key={id} variant={variant} duration={1000000}>
          <div className="flex items-start gap-3">
            {variant && icons[variant] ? (
              <span className="mt-0.5 shrink-0">{icons[variant]}</span>
            ) : null}
            <div className="grid gap-0.5">
              {title ? <ToastTitle>{title}</ToastTitle> : null}
              {description ? (
                <ToastDescription>{description}</ToastDescription>
              ) : null}
            </div>
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
