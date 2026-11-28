import { cn } from "@/lib/utils"

const inputClass =
  "tw:h-[22px] tw:w-full tw:min-w-0 tw:rounded-sm tw:border tw:border-input tw:bg-background tw:px-1.5 tw:py-0 tw:text-entry tw:font-normal tw:text-foreground tw:outline-none tw:transition-[border-color,box-shadow,background-color] tw:duration-150 tw:placeholder:font-normal tw:placeholder:italic tw:placeholder:text-muted-foreground/60 tw:hover:border-input-hover tw:focus-visible:border-ring tw:read-only:bg-secondary tw:disabled:cursor-not-allowed tw:disabled:opacity-60 tw:aria-invalid:border-destructive tw:data-[required=true]:border-required-line tw:file:border-0 tw:file:bg-transparent tw:file:text-entry"

function Input({ className, type = "text", required, leftIcon: LeftIcon, ...props }) {
  const input = (
    <input
      type={type}
      data-slot="input"
      data-required={required ? "true" : undefined}
      className={cn(inputClass, LeftIcon && "tw:pl-6", className)}
      {...props}
    />
  )
  if (!LeftIcon) return input
  return (
    <div className="tw:relative tw:flex tw:min-w-0 tw:flex-1 tw:items-center">
      <LeftIcon className="tw:pointer-events-none tw:absolute tw:left-1.5 tw:size-3.5 tw:text-muted-foreground" />
      {input}
    </div>
  )
}

export { Input, inputClass }
