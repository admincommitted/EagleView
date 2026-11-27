import { useMemo, useState } from 'react';
import { ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"

function MultiSelect({
  options = [],
  value = [],
  onValueChange,
  placeholder = "Select...",
  emptyText = "Nothing found",
  maxChips = 3,
  required,
  disabled,
  id,
  className,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const picked = new Set((value || []).map(String))
  const toggle = (v) => {
    const next = picked.has(String(v)) ? (value || []).filter((x) => String(x) !== String(v)) : [...(value || []), v]
    onValueChange?.(next)
  }
  const labelOf = (v) => options.find((o) => String(o.value) === String(v))?.label ?? v
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => `${o.label} ${o.value}`.toLowerCase().includes(q)) : options
  }, [options, query])

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery("") }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          data-required={required ? "true" : undefined}
          data-filled={value?.length ? "true" : undefined}
          className={cn(
            "tw:flex tw:min-h-[22px] tw:w-full tw:min-w-0 tw:items-center tw:justify-between tw:gap-1 tw:rounded-sm tw:border tw:border-input tw:bg-background tw:px-1 tw:py-0.5 tw:text-left tw:text-entry tw:font-normal tw:text-foreground tw:shadow-soft tw:filter-none tw:outline-none tw:cursor-pointer tw:transition-[border-color,box-shadow] tw:duration-150 tw:hover:border-input-hover tw:focus-visible:border-ring tw:focus-visible:ring-[3px] tw:focus-visible:ring-ring/20 tw:data-[state=open]:border-ring tw:disabled:cursor-not-allowed tw:disabled:opacity-60 tw:data-[required=true]:border-required-line",
            className
          )}
        >
          <span className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-1">
            {!value?.length && <span data-float-placeholder="" className="tw:px-0.5 tw:italic tw:text-muted-foreground/60">{placeholder}</span>}
            {value?.length > maxChips ? (
              <span className="tw:rounded-sm tw:bg-secondary tw:px-1.5 tw:text-[11px] tw:font-semibold tw:text-secondary-foreground">{value.length} picked</span>
            ) : (
              (value || []).map((v) => (
                <span key={String(v)} className="tw:inline-flex tw:items-center tw:gap-0.5 tw:rounded-sm tw:bg-secondary tw:px-1 tw:text-[11px] tw:leading-4 tw:font-semibold tw:text-secondary-foreground">
                  {labelOf(v)}
                  {!disabled && (
                    <X className="tw:size-3 tw:hover:text-destructive" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); toggle(v) }} />
                  )}
                </span>
              ))
            )}
          </span>
          <ChevronsUpDown className="tw:size-3.5 tw:shrink-0 tw:text-muted-foreground tw:opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="tw:w-(--radix-popover-trigger-width) tw:min-w-56 tw:p-0">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {shown.map((o) => (
                <CommandItem key={String(o.value)} value={String(o.value)} onSelect={() => toggle(o.value)}>
                  <Checkbox checked={picked.has(String(o.value))} tabIndex={-1} className="tw:pointer-events-none" />
                  <span className="tw:truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {value?.length > 0 && (
            <div className="tw:flex tw:justify-between tw:border-t tw:border-border tw:px-2 tw:py-1 tw:text-[11px] tw:text-muted-foreground">
              <span>{value.length} picked</span>
              <button type="button" className="tw:border-0 tw:bg-transparent tw:p-0 tw:text-[11px] tw:text-primary tw:shadow-none tw:cursor-pointer" onClick={() => onValueChange?.([])}>Clear all</button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { MultiSelect }
