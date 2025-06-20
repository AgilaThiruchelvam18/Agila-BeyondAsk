import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-[var(--color-text-primary)] text-sm transition-all duration-200 ring-offset-2 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--color-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)] focus-visible:ring-opacity-50 hover:border-[var(--color-primary-light)] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-background-subtle)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
