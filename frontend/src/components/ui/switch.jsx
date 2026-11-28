import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "tw:peer tw:group/switch tw:inline-flex tw:shrink-0 tw:items-center tw:rounded-full tw:border tw:border-transparent tw:p-0 tw:filter-none tw:transition-colors tw:outline-none tw:cursor-pointer tw:focus-visible:ring-2 tw:focus-visible:ring-ring/40 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:data-[size=default]:h-[18px] tw:data-[size=default]:w-[34px] tw:data-[size=sm]:h-3.5 tw:data-[size=sm]:w-6 tw:data-[state=checked]:bg-primary tw:data-[state=unchecked]:bg-input/60",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "tw:pointer-events-none tw:block tw:rounded-full tw:bg-white tw:ring-0 tw:transition-transform tw:group-data-[size=default]/switch:size-4 tw:group-data-[size=sm]/switch:size-3 tw:data-[state=checked]:translate-x-[calc(100%-2px)] tw:data-[state=unchecked]:translate-x-px"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
