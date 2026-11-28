import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

function SearchSelect({
  options = [],
  value,
  onValueChange,
  placeholder = "Search...",
  emptyText = "Nothing found",
  allowCustom = false,
  clearable = true,
  limit = 200,
  required,
  disabled,
  id,
  className,
  contentClassName,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = options.find((o) => String(o.value) === String(value ?? ""))
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hits = q
      ? options.filter((o) => `${o.label} ${o.value} ${o.hint ?? ""}`.toLowerCase().includes(q))
      : options
    return hits.slice(0, limit)
  }, [options, query, limit])

  const pick = (v) => { onValueChange?.(v); setOpen(false); setQuery("") }

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
          data-filled={selected || value ? "true" : undefined}
          className={cn(
            "tw:flex tw:h-[22px] tw:w-full tw:min-w-0 tw:items-center tw:justify-between tw:gap-1 tw:rounded-sm tw:border tw:border-input tw:bg-background tw:px-1.5 tw:py-0 tw:text-left tw:text-entry tw:font-normal tw:text-foreground tw:filter-none tw:outline-none tw:cursor-pointer tw:transition-[border-color,box-shadow] tw:duration-150 tw:hover:border-input-hover tw:focus-visible:border-ring tw:data-[state=open]:border-ring tw:disabled:cursor-not-allowed tw:disabled:opacity-60 tw:data-[required=true]:border-required-line",
            className
          )}
        >
          <span data-float-placeholder={!selected && !value ? "" : undefined} className={cn("tw:truncate", !selected && !value && "tw:italic tw:text-muted-foreground/60")}>
            {selected ? selected.label : value || placeholder}
          </span>
          <span className="tw:flex tw:shrink-0 tw:items-center tw:gap-0.5 tw:text-muted-foreground">
            {clearable && value && !disabled && (
              <X
                className="tw:size-3 tw:hover:text-destructive"
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onValueChange?.("") }}
              />
            )}
            <ChevronsUpDown className="tw:size-3.5 tw:opacity-60" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("tw:w-(--radix-popover-trigger-width) tw:min-w-56 tw:p-0", contentClassName)}
      >
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>
              {allowCustom && query.trim() ? (
                <button type="button" className="tw:w-full tw:border-0 tw:bg-transparent tw:px-2 tw:text-left tw:text-entry tw:text-primary tw:cursor-pointer" onClick={() => pick(query.trim())}>
                  Use “{query.trim()}”
                </button>
              ) : emptyText}
            </CommandEmpty>
            <CommandGroup>
              {shown.map((o) => (
                <CommandItem key={String(o.value)} value={String(o.value)} onSelect={() => pick(o.value)}>
                  <Check className={cn("tw:size-3.5", String(o.value) === String(value ?? "") ? "tw:opacity-100" : "tw:opacity-0")} />
                  <span className="tw:truncate">{o.label}</span>
                  {o.hint && <span className="tw:ml-auto tw:shrink-0 tw:text-[11px] tw:text-muted-foreground">{o.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
            {allowCustom && query.trim() && shown.length > 0 && !shown.some((o) => String(o.label).toLowerCase() === query.trim().toLowerCase()) && (
              <CommandGroup>
                <CommandItem value={`__custom__${query}`} onSelect={() => pick(query.trim())}>
                  <span className="tw:text-primary">Use “{query.trim()}”</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { SearchSelect }
