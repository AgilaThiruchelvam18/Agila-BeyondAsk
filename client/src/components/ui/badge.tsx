import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:ring-offset-2 focus:ring-opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]",
        secondary:
          "border-transparent bg-[var(--color-secondary)] text-white hover:bg-[var(--color-secondary-dark)]",
        success:
          "border-transparent bg-[var(--color-success)] text-white hover:bg-[var(--color-success-dark)]",
        warning:
          "border-transparent bg-[var(--color-warning)] text-white hover:bg-[var(--color-warning-dark)]",
        info:
          "border-transparent bg-[var(--color-info)] text-white hover:bg-[var(--color-info-dark)]",
        destructive:
          "border-transparent bg-[var(--color-error)] text-white hover:bg-[var(--color-error-dark)]",
        outline: "border-[var(--color-border)] bg-white text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
