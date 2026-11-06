import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#2878E5] text-white hover:bg-[#1F65C2]",
        secondary:
          "border-transparent bg-[#F3F6FC] text-[#202735] hover:bg-[#E8EDF4]",
        destructive:
          "border-transparent bg-[#F07862] text-white hover:bg-[#D9634E]",
        outline: "text-[#202735] border-[#E8EDF4]",
        income: "border-transparent bg-[#EAF6F1] text-[#269B72]",
        expense: "border-transparent bg-[#FDF1EE] text-[#F07862]",
        warning: "border-transparent bg-[#FEF8EC] text-[#E9B949]",
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
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
