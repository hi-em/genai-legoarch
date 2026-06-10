import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

// A modal host for the trophy artifacts, opened from the reveal CTAs.
export default function TrophyShell({ open, onClose, title, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] max-h-[92vh] w-[min(96vw,940px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-elevated p-5 shadow-pop focus:outline-none">
          <Dialog.Description className="sr-only">{title} for your generated set.</Dialog.Description>
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="font-display text-lg font-extrabold text-ink">{title}</Dialog.Title>
            <Dialog.Close className="grid h-7 w-7 place-items-center rounded-full bg-sunken text-muted hover:text-ink" aria-label="Close">
              <X size={16} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
