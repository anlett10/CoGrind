import { cn } from "~/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva, VariantProps } from "class-variance-authority";
import React from "react";

const shimmerButtonVariants = cva(
  cn(
    "relative cursor-pointer group transition-all duration-300",
    "inline-flex items-center justify-center gap-2 shrink-0",
    "rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "text-sm font-medium whitespace-nowrap",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    "bg-gradient-to-r from-blue-600 via-sky-600 to-blue-600 bg-[length:200%] animate-shimmer",
    "hover:shadow-lg hover:shadow-blue-500/25",
    "active:scale-95",
  ),
  {
    variants: {
      variant: {
        default: "text-white",
        outline: "bg-transparent border border-white/20 text-white hover:bg-white/10",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ShimmerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof shimmerButtonVariants> {
  asChild?: boolean;
}

const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        data-slot="button"
        className={cn(shimmerButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);

ShimmerButton.displayName = "ShimmerButton";

export { ShimmerButton, shimmerButtonVariants, type ShimmerButtonProps };
