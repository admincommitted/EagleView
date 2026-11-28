import { Check, Lightbulb, Loader2, X } from "lucide-react"
import toast, { resolveValue } from "react-hot-toast"
import { cn } from "@/lib/utils"
import { Button } from "./button"

// Every toast of the app (toast.success / error / loading / plain toast): a light tinted card with a coloured edge, a
// round icon, a title and the message, and a close button. It slides in from the right edge and back out to it.
// A plain toast with icon '⚠️' is a warning; any other plain toast is information. The colours are brighter than the
// app's text colours (--success / --warning are dark for text); the message text itself stays dark.
const KINDS = {
  success: { title: "Success", colour: "#22c55e", icon: Check },
  error: { title: "Error", colour: "#ef4444", icon: X },
  warning: { title: "Warning", colour: "#f5b301", mark: "!" },
  info: { title: "Info", colour: "var(--info)", icon: Lightbulb },
  loading: { title: "Please wait", colour: "var(--info)", icon: Loader2, spin: true },
}

const WARNING_ICONS = ["⚠️", "⚠"]

function kindOf(item) {
  if (KINDS[item.type] && item.type !== "warning" && item.type !== "info") return item.type
  return WARNING_ICONS.includes(item.icon) ? "warning" : "info"
}

function ToastMark({ kind }) {
  const { icon: Icon, mark, spin } = KINDS[kind]
  return (
    <span className="tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-[var(--toast-colour)] tw:text-sm tw:font-bold tw:text-white">
      {Icon ? <Icon className={cn("tw:size-4", spin && "tw:animate-spin")} strokeWidth={3} /> : mark}
    </span>
  )
}

function AppToast({ item }) {
  const kind = kindOf(item)
  const { title, colour } = KINDS[kind]
  return (
    <div
      {...item.ariaProps}
      style={{ "--toast-colour": colour }}
      className={cn(
        "tw:flex tw:w-[380px] tw:max-w-[calc(100vw-32px)] tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-[var(--toast-colour)] tw:bg-[color-mix(in_srgb,var(--toast-colour)_8%,var(--background))] tw:px-3 tw:py-2.5 tw:text-foreground tw:normal-case",
        item.visible ? "tw:animate-toast-in" : "tw:animate-toast-out"
      )}
    >
      <ToastMark kind={kind} />
      <div className="tw:min-w-0 tw:flex-1">
        <div className="tw:text-[13px] tw:leading-5 tw:font-bold">{title}</div>
        <div className="tw:text-[12px] tw:leading-4 tw:break-words tw:whitespace-pre-line tw:text-muted-foreground">{resolveValue(item.message, item)}</div>
      </div>
      <Button variant="ghost" size="icon-sm" className="tw:shrink-0 tw:text-muted-foreground tw:hover:text-foreground" aria-label="Close" title="Close" onClick={() => toast.dismiss(item.id)}>
        <X />
      </Button>
    </div>
  )
}

export { AppToast }
