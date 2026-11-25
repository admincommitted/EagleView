import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

function InfoTip({ children, side = "top", className }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Help"
          className={cn(
            "tw:inline-flex tw:size-4 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:border-0 tw:bg-transparent tw:p-0 tw:text-primary tw:shadow-none tw:filter-none tw:cursor-help tw:hover:text-head",
            className
          )}
        >
          <Info className="tw:size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="tw:max-w-72 tw:normal-case">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

export { InfoTip }
