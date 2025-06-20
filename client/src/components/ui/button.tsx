import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] hover:-translate-y-[2px] hover:shadow-md",
        destructive:
          "bg-[var(--color-error)] text-white hover:bg-[#dc2626] hover:-translate-y-[2px] hover:shadow-md",
        outline:
          "bg-transparent border-2 border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white hover:-translate-y-[2px]",
        secondary:
          "bg-[var(--color-secondary)] text-white hover:bg-[#e43bb6] hover:-translate-y-[2px] hover:shadow-md",
        ghost: "hover:bg-[rgba(109,106,255,0.05)] text-[var(--color-primary)]",
        link: "text-[var(--color-primary)] hover:bg-transparent underline-offset-4 hover:underline",
        success: "bg-[var(--color-success)] text-white hover:bg-[#0da271] hover:-translate-y-[2px] hover:shadow-md",
        warning: "bg-[var(--color-warning)] text-white hover:bg-[#f5a623] hover:-translate-y-[2px] hover:shadow-md",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 py-1.5 text-sm",
        lg: "h-12 rounded-lg px-8 py-3 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
