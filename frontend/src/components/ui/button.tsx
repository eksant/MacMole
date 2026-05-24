import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default:     "bg-primary/85 text-primary-foreground shadow hover:bg-primary",
        destructive: "bg-destructive/80 text-destructive-foreground hover:bg-destructive",
        outline:     "border border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06] hover:border-white/20",
        secondary:   "bg-secondary/80 text-secondary-foreground hover:bg-secondary",
        ghost:       "text-foreground/70 hover:bg-white/[0.05] hover:text-foreground",
        link:        "text-primary underline-offset-4 hover:underline",
        glass:       "border border-white/[0.08] bg-white/[0.04] text-foreground/80 backdrop-blur-sm hover:bg-white/[0.07] hover:border-white/[0.14] hover:text-foreground",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-7 px-3 text-xs",
        lg:      "h-10 px-6",
        icon:    "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
