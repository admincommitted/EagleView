import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "tw:fixed tw:inset-0 tw:z-[3000] tw:bg-slate-900/45 tw:backdrop-blur-[3px] tw:data-[state=closed]:animate-out tw:data-[state=closed]:fade-out-0 tw:data-[state=open]:animate-in tw:data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  closeButtonClassName,
  children,
  showCloseButton = true,
  ...props
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "tw:fixed tw:top-[50%] tw:left-[50%] tw:z-[3000] tw:flex tw:max-h-[calc(100vh-2rem)] tw:w-full tw:max-w-[calc(100%-2rem)] tw:translate-x-[-50%] tw:translate-y-[-50%] tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-border tw:bg-background tw:text-entry tw:text-foreground tw:normal-case tw:duration-200 tw:outline-none tw:data-[state=closed]:animate-out tw:data-[state=closed]:fade-out-0 tw:data-[state=closed]:zoom-out-95 tw:data-[state=open]:animate-in tw:data-[state=open]:fade-in-0 tw:data-[state=open]:zoom-in-95 tw:data-[state=open]:slide-in-from-bottom-2 tw:sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              "tw:absolute tw:top-2.5 tw:right-2.5 tw:inline-flex tw:size-7 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:border-0 tw:bg-transparent tw:p-0 tw:text-muted-foreground tw:opacity-80 tw:filter-none tw:transition-all tw:duration-150 tw:hover:rotate-90 tw:hover:bg-accent tw:hover:opacity-100 tw:active:scale-90 tw:focus-visible:ring-2 tw:focus-visible:ring-ring/40 tw:focus:outline-hidden tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-4",
              closeButtonClassName
            )}
          >
            <XIcon />
            <span className="tw:sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("tw:flex tw:flex-col tw:gap-0.5 tw:border-b tw:border-border tw:px-4 tw:py-2.5 tw:pr-10 tw:text-left", className)}
      {...props}
    />
  )
}

/** The scrolling middle of the popup (form rows). */
function DialogBody({
  className,
  ...props
}) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-2.5 tw:overflow-y-auto tw:px-4 tw:py-3", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "tw:flex tw:flex-row tw:flex-wrap tw:items-center tw:justify-end tw:gap-2 tw:border-t tw:border-border tw:px-4 tw:py-2.5",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("tw:m-0 tw:text-[17px] tw:leading-6 tw:font-normal tw:tracking-normal tw:text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("tw:m-0 tw:text-entry tw:text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
