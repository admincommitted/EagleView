import { cn } from "@/lib/utils"
import { Label as LabelPrimitive } from "radix-ui"

function Label({
  className,
  required,
  ...props
}) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      data-required={required ? "true" : undefined}
      className={cn(
        "tw:m-0 tw:flex tw:items-center tw:gap-1 tw:text-entry tw:leading-4 tw:font-normal tw:whitespace-nowrap tw:text-foreground tw:select-none tw:data-[required=true]:italic tw:data-[required=true]:text-required tw:group-data-[disabled=true]:pointer-events-none tw:group-data-[disabled=true]:opacity-50 tw:peer-disabled:cursor-not-allowed tw:peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
