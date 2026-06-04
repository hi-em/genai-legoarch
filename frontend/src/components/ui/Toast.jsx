import * as RToast from "@radix-ui/react-toast";
import { create } from "zustand";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "../../lib/cn.js";

let _id = 0;
export const useToasts = create((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts, { id: ++_id, ...t }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

// Imperative API usable from anywhere (including non-React code paths).
export const toast = {
  success: (title, description) => useToasts.getState().push({ variant: "success", title, description }),
  error: (title, description) => useToasts.getState().push({ variant: "error", title, description }),
  info: (title, description) => useToasts.getState().push({ variant: "info", title, description }),
};

const META = {
  success: { Icon: CheckCircle2, border: "border-l-ok-fg", color: "text-ok-fg" },
  error: { Icon: AlertTriangle, border: "border-l-warn-fg", color: "text-warn-fg" },
  info: { Icon: Info, border: "border-l-brand-blue", color: "text-brand-blue" },
};

export default function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <RToast.Provider swipeDirection="right" duration={3500}>
      {toasts.map((t) => {
        const { Icon, border, color } = META[t.variant] || META.info;
        return (
          <RToast.Root
            key={t.id}
            type={t.variant === "error" ? "foreground" : "background"}
            duration={t.variant === "error" ? 6000 : 3500}
            onOpenChange={(open) => { if (!open) dismiss(t.id); }}
            className={cn(
              "relative flex items-start gap-3 rounded-lg bg-elevated shadow-pop border-l-4 p-3 pr-9",
              "data-[state=open]:animate-in data-[state=closed]:animate-out slide-in-from-right-6 fade-in-0 fade-out-0",
              "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=end]:animate-out",
              border
            )}
          >
            <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", color)} aria-hidden="true" />
            <div className="min-w-0">
              <RToast.Title className="font-display font-extrabold text-sm text-ink">{t.title}</RToast.Title>
              {t.description && (
                <RToast.Description className="text-sm text-muted mt-0.5 break-words">
                  {t.description}
                </RToast.Description>
              )}
            </div>
            <RToast.Close
              className="absolute top-2 right-2 grid place-items-center w-6 h-6 rounded-full text-muted hover:bg-sunken"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </RToast.Close>
          </RToast.Root>
        );
      })}
      <RToast.Viewport className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)] outline-none m-0 list-none p-0" />
    </RToast.Provider>
  );
}
