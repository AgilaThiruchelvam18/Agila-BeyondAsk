import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 shadow-sm transition-all duration-300 [&>svg~*]:pl-10 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-white text-[var(--color-text-primary)] border-[var(--color-border)]",
        info: "bg-[var(--color-info-light)] border-[var(--color-info)] text-[var(--color-info-dark)] [&>svg]:text-[var(--color-info)]",
        success: "bg-[var(--color-success-light)] border-[var(--color-success)] text-[var(--color-success-dark)] [&>svg]:text-[var(--color-success)]",
        warning: "bg-[var(--color-warning-light)] border-[var(--color-warning)] text-[var(--color-warning-dark)] [&>svg]:text-[var(--color-warning)]",
        destructive: "bg-[var(--color-error-light)] border-[var(--color-error)] text-[var(--color-error-dark)] [&>svg]:text-[var(--color-error)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold leading-none tracking-tight text-current", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-current opacity-90 [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
