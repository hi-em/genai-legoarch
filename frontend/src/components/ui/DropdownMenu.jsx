import * as RDM from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/cn.js";

export const DropdownMenu = RDM.Root;
export const DropdownTrigger = RDM.Trigger; // use with asChild
export const DropdownLabel = RDM.Label;
export const DropdownSeparator = (props) => (
  <RDM.Separator className="my-1 h-px bg-border" {...props} />
);

export function DropdownContent({ className, sideOffset = 6, align = "start", ...props }) {
  return (
    <RDM.Portal>
      <RDM.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-[120] min-w-[210px] rounded-lg bg-elevated border border-border shadow-pop p-1",
          "data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 fade-out-0 zoom-in-95",
          className
        )}
        {...props}
      />
    </RDM.Portal>
  );
}

export function DropdownItem({ className, ...props }) {
  return (
    <RDM.Item
      className={cn(
        "flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium text-ink cursor-pointer outline-none",
        "data-[highlighted]:bg-sunken data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
        "[&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-muted",
        className
      )}
      {...props}
    />
  );
}
