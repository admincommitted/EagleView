import { X } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

const SIDES = {
  left: "tw:inset-y-0 tw:left-0 tw:h-full tw:w-[min(20rem,85vw)] tw:border-r tw:data-[state=closed]:slide-out-to-left tw:data-[state=open]:slide-in-from-left",
  right: "tw:inset-y-0 tw:right-0 tw:h-full tw:w-[min(20rem,85vw)] tw:border-l tw:data-[state=closed]:slide-out-to-right tw:data-[state=open]:slide-in-from-right",
}

function Sheet(props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetContent({ side = "left", title, description, className, children, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="tw:fixed tw:inset-0 tw:z-[3000] tw:bg-black/50 tw:data-[state=closed]:animate-out tw:data-[state=closed]:fade-out-0 tw:data-[state=open]:animate-in tw:data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "tw:fixed tw:z-[3000] tw:flex tw:flex-col tw:border-border tw:bg-background tw:text-entry tw:text-foreground tw:normal-case tw:outline-none tw:duration-200 tw:data-[state=closed]:animate-out tw:data-[state=open]:animate-in",
          SIDES[side],
          className
        )}
        {...props}
      >
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border tw:px-3 tw:py-2">
          <DialogPrimitive.Title className="tw:m-0 tw:text-sm tw:font-bold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close"
            className="tw:flex tw:size-7 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-sm tw:border-0 tw:bg-transparent tw:text-muted-foreground tw:hover:bg-accent tw:hover:text-foreground"
          >
            <X className="tw:size-4" />
          </DialogPrimitive.Close>
        </div>
        <DialogPrimitive.Description className="tw:sr-only">{description || title}</DialogPrimitive.Description>
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent }
