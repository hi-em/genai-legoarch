import * as RT from "@radix-ui/react-tooltip";
import { cn } from "../../lib/cn.js";

export function TooltipProvider(props) {
  return <RT.Provider delayDuration={250} skipDelayDuration={300} {...props} />;
}

// Convenience wrapper: <Tooltip content="…"><button/></Tooltip>
export function Tooltip({ content, children, side = "top", className }) {
  if (!content) return children;
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-[120] rounded bg-ink text-on-dark text-caption font-medium px-2 py-1 shadow-pop",
            "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out fade-in-0 fade-out-0 zoom-in-95",
            className
          )}
        >
          {content}
          <RT.Arrow className="fill-ink" />
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
