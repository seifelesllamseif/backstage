import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// Small icon-only button. Ports design/ui.jsx Button ghost variant for the
// 24px icon case. Pairs with lucide-react icons sized 14–16.

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string; // accessible label
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(
  ({ className, children, label, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
