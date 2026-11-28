import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

const TONES = {
  primary: { bar: "tw:border-l-primary", text: "tw:text-primary" },
  success: { bar: "tw:border-l-success", text: "tw:text-success" },
  warning: { bar: "tw:border-l-warning", text: "tw:text-warning" },
  danger: { bar: "tw:border-l-destructive", text: "tw:text-destructive" },
  neutral: { bar: "tw:border-l-input", text: "tw:text-muted-foreground" },
}

function StatCard({ label, value, icon: Icon, tone = "primary", active, onClick, onRefresh, title, className }) {
  const colors = TONES[tone]
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={title}
      onClick={onClick}
      onKeyDown={(event) => onClick && (event.key === "Enter" || event.key === " ") && onClick()}
      className={cn(
        "tw:relative tw:flex tw:min-h-[76px] tw:flex-col tw:justify-between tw:overflow-hidden tw:rounded-lg tw:border tw:border-l-4 tw:border-border tw:bg-card tw:px-3.5 tw:py-2.5 tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring/40",
        colors.bar,
        onClick && "tw:cursor-pointer tw:transition-colors tw:hover:bg-accent",
        active && "tw:bg-accent tw:ring-2 tw:ring-primary/40",
        className
      )}
    >
      {Icon && <Icon className={cn("tw:pointer-events-none tw:absolute tw:-right-2 tw:-bottom-3 tw:size-16 tw:opacity-10", colors.text)} />}
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
        <span className="tw:text-[10px] tw:font-bold tw:tracking-wide tw:text-muted-foreground tw:uppercase">{label}</span>
        {onRefresh && (
          <RefreshCw
            aria-label="Refresh"
            className="tw:size-3 tw:shrink-0 tw:text-muted-foreground tw:opacity-70 tw:hover:opacity-100"
            onClick={(event) => { event.stopPropagation(); onRefresh() }}
          />
        )}
      </div>
      <span className={cn("tw:text-[28px] tw:leading-none tw:font-extrabold tw:tabular-nums", colors.text)}>{value}</span>
    </div>
  )
}

export { StatCard }
