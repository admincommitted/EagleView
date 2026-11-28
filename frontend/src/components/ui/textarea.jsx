import { cn } from "@/lib/utils"

function Textarea({
  className,
  required,
  ...props
}) {
  return (
    <textarea
      data-slot="textarea"
      data-required={required ? "true" : undefined}
      className={cn(
        "tw:flex tw:min-h-11 tw:w-full tw:resize-y tw:rounded-sm tw:border tw:border-input tw:bg-background tw:px-1.5 tw:py-1 tw:text-entry tw:font-normal tw:text-foreground tw:outline-none tw:transition-[border-color,box-shadow] tw:duration-150 tw:placeholder:italic tw:placeholder:text-muted-foreground/60 tw:hover:border-input-hover tw:focus-visible:border-ring tw:read-only:bg-secondary tw:disabled:cursor-not-allowed tw:disabled:opacity-60 tw:aria-invalid:border-destructive tw:data-[required=true]:border-required-line",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
