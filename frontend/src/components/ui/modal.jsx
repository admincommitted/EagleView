import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// the heading band is in the theme colour: everything in the title (icons, coloured words) takes its white text
const HEADER_CLASS = "tw:border-b-0 tw:bg-linear-to-r tw:from-primary-from tw:to-primary-to tw:text-primary-foreground"
const TITLE_CLASS = "tw:flex tw:items-center tw:gap-1.5 tw:text-[15px] tw:font-semibold tw:text-inherit tw:[&_*]:text-inherit tw:[&_svg]:text-current"
const DESCRIPTION_CLASS = "tw:text-white/80"
const HEADER_CLOSE_CLASS = "tw:text-white tw:opacity-90 tw:hover:bg-white/20"

/**
 * onOk adds the standard OK / Cancel buttons; footer replaces them with your own.
 * closeOnOutside={false} keeps a half-filled form open when the user clicks beside it.
 */
function Modal({
  open,
  onClose,
  title,
  description,
  width = 560,
  onOk,
  okLabel = "OK",
  cancelLabel = "Cancel",
  footer,
  closeOnOutside = true,
  showCloseButton = true,
  className,
  bodyClassName,
  children,
}) {
  const actions = footer ?? (onOk && (
    <>
      <Button variant="success" onClick={onOk}>{okLabel}</Button>
      <Button onClick={onClose}>{cancelLabel}</Button>
    </>
  ))

  return (
    <Dialog open={Boolean(open)} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent
        showCloseButton={showCloseButton}
        className={cn("tw:w-(--modal-w) tw:sm:max-w-[calc(100%-2rem)]", className)}
        closeButtonClassName={HEADER_CLOSE_CLASS}
        style={{ "--modal-w": typeof width === "number" ? `${width}px` : width }}
        onInteractOutside={closeOnOutside ? undefined : (event) => event.preventDefault()}
      >
        <DialogHeader className={HEADER_CLASS}>
          <DialogTitle className={TITLE_CLASS}>{title}</DialogTitle>
          <DialogDescription className={cn(DESCRIPTION_CLASS, !description && "tw:sr-only")}>{description || (typeof title === "string" ? title : "Window")}</DialogDescription>
        </DialogHeader>
        <DialogBody className={bodyClassName}>{children}</DialogBody>
        {actions && <DialogFooter>{actions}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

export { Modal }
