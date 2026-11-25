import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const TONE_CLASS = {
  danger: "tw:text-destructive tw:[&_svg]:text-destructive",
  success: "tw:[&_svg]:text-success",
  accent: "tw:[&_svg]:text-primary",
}

function ActionMenuItem({ item }) {
  if (item.separator) return <DropdownMenuSeparator />
  if (item.heading) return <DropdownMenuLabel className="tw:text-[10px] tw:font-bold tw:tracking-wide tw:text-muted-foreground tw:uppercase">{item.heading}</DropdownMenuLabel>
  const Icon = item.icon
  return (
    <DropdownMenuItem disabled={item.disabled} title={item.title} onSelect={item.onSelect} className={cn("tw:gap-2 tw:py-1 tw:text-entry", TONE_CLASS[item.tone])}>
      {Icon && <Icon className="tw:size-3.5" />}
      <span className="tw:flex tw:min-w-0 tw:flex-col">
        <span>{item.label}</span>
        {item.description && <span className="tw:text-[10px] tw:text-muted-foreground">{item.description}</span>}
      </span>
      {item.note && <span className="tw:ml-auto tw:text-[10px] tw:text-muted-foreground">{item.note}</span>}
    </DropdownMenuItem>
  )
}

/**
 * items: [{ heading }, { separator: true }, { label, description, icon, onSelect, disabled, title, note, tone }]
 * Opens from `trigger`, or at `position` ({ x, y }) for a right-click menu (with open / onOpenChange).
 */
function ActionMenu({ items, trigger, position, open, onOpenChange, align = "start", className }) {
  const pointAnchor = (
    <DropdownMenuTrigger asChild>
      <span
        aria-hidden
        className="tw:pointer-events-none tw:fixed tw:top-(--menu-y) tw:left-(--menu-x) tw:size-0"
        style={{ '--menu-x': `${position?.x ?? 0}px`, '--menu-y': `${position?.y ?? 0}px` }}
      />
    </DropdownMenuTrigger>
  )
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      {trigger ? <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger> : createPortal(pointAnchor, document.body)}
      <DropdownMenuContent align={align} className={cn("tw:max-h-[70vh] tw:min-w-56 tw:overflow-y-auto tw:normal-case", className)}>
        {items.map((item, index) => <ActionMenuItem key={item.label || item.heading || `separator-${index}`} item={item} />)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ActionMenu }
