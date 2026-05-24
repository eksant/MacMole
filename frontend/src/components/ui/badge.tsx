import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:     "border-primary/30 bg-primary/10 text-primary",
        secondary:   "border-secondary/30 bg-secondary/10 text-secondary",
        destructive: "border-destructive/30 bg-destructive/10 text-red-400",
        success:     "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        warning:     "border-amber-500/30 bg-amber-500/10 text-amber-400",
        outline:     "border-white/10 bg-white/[0.04] text-foreground/70",
        muted:       "border-white/[0.07] bg-white/[0.03] text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
