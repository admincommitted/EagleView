import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// raised buttons lift a little on hover and sink back when pressed; flat ones (ghost, link, menu bar) only change colour
const RAISED = "tw:shadow-soft tw:hover:-translate-y-px tw:hover:shadow-lift tw:active:translate-y-0 tw:active:shadow-none"

const buttonVariants = cva(
  "tw:inline-flex tw:shrink-0 tw:items-center tw:justify-center tw:gap-1 tw:rounded-md tw:border tw:text-btn tw:font-semibold tw:whitespace-nowrap tw:shadow-none tw:filter-none tw:transition-[color,background-color,border-color,box-shadow,transform] tw:duration-150 tw:ease-out tw:outline-none tw:cursor-pointer tw:select-none tw:active:scale-[0.97] tw:focus-visible:ring-2 tw:focus-visible:ring-ring/40 tw:focus-visible:ring-offset-1 tw:disabled:pointer-events-none tw:disabled:opacity-55 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-3.5",
  {
    variants: {
      variant: {
        default: `tw:border-primary tw:bg-primary tw:text-primary-foreground tw:hover:border-primary-dark tw:hover:bg-primary-dark ${RAISED}`,
        outline: `tw:border-input tw:bg-background tw:text-head tw:hover:border-input-hover tw:hover:bg-page ${RAISED}`,
        success: `tw:border-input tw:bg-background tw:text-success tw:hover:border-success/50 tw:hover:bg-success/5 ${RAISED}`,
        destructive: `tw:border-destructive/40 tw:bg-background tw:text-destructive tw:hover:border-destructive/60 tw:hover:bg-destructive/5 ${RAISED}`,
        warning: `tw:border-input tw:bg-background tw:text-warning tw:hover:border-warning/50 tw:hover:bg-warning/5 ${RAISED}`,
        secondary: `tw:border-border tw:bg-secondary tw:text-secondary-foreground tw:hover:bg-accent ${RAISED}`,
        ghost: "tw:border-transparent tw:bg-transparent tw:text-head tw:hover:bg-accent",
        link: "tw:border-transparent tw:bg-transparent tw:px-0 tw:text-primary tw:underline-offset-2 tw:hover:underline tw:active:scale-100",
        header: "tw:border-transparent tw:bg-transparent tw:text-white tw:hover:bg-white/20 tw:focus-visible:ring-white/50 tw:focus-visible:ring-offset-0 tw:data-[state=open]:bg-white/20",
      },
      size: {
        default: "tw:h-6 tw:px-2.5",
        sm: "tw:h-[22px] tw:px-1.5",
        lg: "tw:h-8 tw:px-4 tw:text-entry",
        icon: "tw:size-6 tw:p-0",
        "icon-sm": "tw:size-[22px] tw:p-0",
        block: "tw:h-auto tw:w-full tw:justify-start tw:px-2.5 tw:py-2 tw:text-left tw:text-entry tw:font-normal tw:whitespace-normal tw:shadow-none tw:hover:translate-y-0 tw:hover:shadow-none tw:active:scale-100",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "outline",
  size = "default",
  asChild = false,
  type = "button",
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
