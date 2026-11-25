import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"

const asText = (value) => (value == null ? "" : String(value))
const isObject = (option) => typeof option === "object" && option !== null
const CLOSE_AFTER_BLUR_MS = 120

function ComboInput({
  options = [],
  value,
  onValueChange,
  onSelect,
  getValue = (option) => (isObject(option) ? option.value : option),
  getLabel = (option) => (isObject(option) ? option.label : ""),
  renderOption,
  filter,
  limit = 50,
  upper = false,
  placeholder,
  className,
  listClassName,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}) {
  const [open, setOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [query, setQuery] = useState("")
  const [highlighted, setHighlighted] = useState(-1)
  const [usedArrows, setUsedArrows] = useState(false)
  const anchorRef = useRef(null)
  const listRef = useRef(null)

  const matches = useCallback(
    (option, text) => (filter
      ? filter(option, text)
      : `${asText(getValue(option))} ${asText(getLabel(option))}`.toLowerCase().includes(text.toLowerCase())),
    [filter, getValue, getLabel]
  )
  const shown = useMemo(() => {
    const text = typing ? query.trim() : ""
    return (text ? options.filter((option) => matches(option, text)) : options).slice(0, limit)
  }, [options, typing, query, matches, limit])

  useEffect(() => {
    if (!open || highlighted < 0 || !listRef.current) return
    listRef.current.children[highlighted]?.scrollIntoView?.({ block: "nearest" })
  }, [highlighted, open])

  const close = () => { setOpen(false); setTyping(false); setUsedArrows(false); setHighlighted(-1) }
  const pick = (option) => {
    setQuery("")
    close()
    if (onSelect) onSelect(option)
    else onValueChange?.(asText(getValue(option)))
  }
  const highlightedOption = open && highlighted >= 0 ? shown[highlighted] : undefined

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setOpen(true)
      setUsedArrows(true)
      setHighlighted((current) => Math.min(current + 1, shown.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setUsedArrows(true)
      setHighlighted((current) => Math.max(current - 1, -1))
    } else if (event.key === "Enter" && highlightedOption) {
      event.preventDefault()
      pick(highlightedOption)
    } else if (event.key === "Escape" && open) {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === "Tab") {
      if (usedArrows && highlightedOption) pick(highlightedOption)
      else close()
    }
    onKeyDown?.(event)
  }

  return (
    <Popover open={open && shown.length > 0} onOpenChange={(isOpen) => { if (!isOpen) close() }}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className={cn("tw:relative tw:flex tw:min-w-0 tw:flex-1", className)}>
          <Input
            autoComplete="off"
            data-allow-text=""
            value={open && typing ? query : asText(value)}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={open}
            onChange={(event) => {
              const text = upper ? event.target.value.toUpperCase() : event.target.value
              setQuery(text); setTyping(true); setOpen(true); setUsedArrows(false); setHighlighted(text ? 0 : -1)
              onValueChange?.(text)
            }}
            onFocus={(event) => {
              setOpen(true); setQuery(""); setTyping(false); setUsedArrows(false); setHighlighted(-1)
              const input = event.target
              setTimeout(() => input.select?.(), 0)
              onFocus?.(event)
            }}
            onBlur={(event) => {
              setTimeout(() => { if (!anchorRef.current?.contains(document.activeElement)) close() }, CLOSE_AFTER_BLUR_MS)
              onBlur?.(event)
            }}
            onKeyDown={handleKeyDown}
            className={cn(upper && "tw:uppercase")}
            {...props}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={1}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => { if (anchorRef.current?.contains(event.target)) event.preventDefault() }}
        className={cn("tw:max-h-64 tw:w-(--radix-popover-trigger-width) tw:min-w-48 tw:overflow-y-auto tw:p-0 tw:normal-case", listClassName)}
      >
        <div ref={listRef} role="listbox">
          {shown.map((option, index) => (
            <div
              key={`${asText(getValue(option))}-${index}`}
              role="option"
              aria-selected={index === highlighted}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => pick(option)}
              className={cn(
                "tw:flex tw:cursor-pointer tw:items-baseline tw:gap-2 tw:border-b tw:border-border/40 tw:px-2 tw:py-1 tw:text-entry",
                index === highlighted && "tw:bg-accent tw:text-accent-foreground"
              )}
            >
              {renderOption ? renderOption(option) : (
                <>
                  <span className="tw:font-semibold tw:text-primary">{asText(getValue(option))}</span>
                  {getLabel(option) ? <span className="tw:truncate tw:text-[11px] tw:text-muted-foreground">{getLabel(option)}</span> : null}
                </>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { ComboInput }
