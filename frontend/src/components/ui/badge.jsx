import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "tw:inline-flex tw:w-fit tw:shrink-0 tw:items-center tw:justify-center tw:gap-1 tw:overflow-hidden tw:rounded-full tw:border tw:border-transparent tw:px-2 tw:py-px tw:text-[10px] tw:leading-4 tw:font-bold tw:tracking-wide tw:whitespace-nowrap tw:transition-[color,box-shadow] tw:focus-visible:ring-2 tw:focus-visible:ring-ring/40 tw:[&>svg]:pointer-events-none tw:[&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "tw:bg-primary tw:text-primary-foreground tw:[a&]:hover:bg-primary/90",
        secondary: "tw:bg-secondary tw:text-secondary-foreground tw:[a&]:hover:bg-secondary/90",
        destructive: "tw:bg-destructive tw:text-white tw:[a&]:hover:bg-destructive/90",
        outline: "tw:border-border tw:text-foreground tw:[a&]:hover:bg-accent",
        ghost: "tw:[a&]:hover:bg-accent tw:[a&]:hover:text-accent-foreground",
        link: "tw:text-primary tw:underline-offset-4 tw:[a&]:hover:underline",
        neutral: "tw:border-input/40 tw:bg-muted tw:text-muted-foreground",
        info: "tw:border-primary/25 tw:bg-primary/10 tw:text-head",
        success: "tw:border-success/25 tw:bg-success/10 tw:text-success",
        warning: "tw:border-warning/25 tw:bg-warning/10 tw:text-warning",
        danger: "tw:border-destructive/25 tw:bg-destructive/10 tw:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
