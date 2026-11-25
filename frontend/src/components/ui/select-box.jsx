import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const NONE = "__none__"

function SelectBox({
  options = [],
  value,
  onValueChange,
  placeholder = "Select...",
  clearable = false,
  clearLabel = "(none)",
  name,
  id,
  required,
  disabled,
  className,
  contentClassName,
  size,
}) {
  const v = value == null || value === "" ? undefined : String(value)
  return (
    <Select value={v ?? ""} onValueChange={(x) => onValueChange?.(x === NONE ? "" : x)} name={name} disabled={disabled}>
      <SelectTrigger id={id} required={required} className={className} size={size}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {clearable && <SelectItem value={NONE} className="tw:italic tw:text-muted-foreground">{clearLabel}</SelectItem>}
        {options.map((o) => {
          const val = String(typeof o === "object" ? o.value : o)
          const label = typeof o === "object" ? (o.label ?? o.value) : o
          return <SelectItem key={val} value={val}>{label}</SelectItem>
        })}
      </SelectContent>
    </Select>
  )
}

export { SelectBox }
