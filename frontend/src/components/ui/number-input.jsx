import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

function NumberInput({
  value,
  onValueChange,
  onChange,
  decimals,
  negative = false,
  align = "left",
  className,
  ...props
}) {
  const clean = (text) => {
    let s = String(text ?? "").replace(/,/g, "").replace(negative ? /[^0-9.-]/g : /[^0-9.]/g, "")
    if (negative) s = (s.startsWith("-") ? "-" : "") + s.replace(/-/g, "")
    if (decimals === 0) return s.replace(/\./g, "")
    const [whole, ...rest] = s.split(".")
    if (!rest.length) return whole
    let frac = rest.join("")
    if (decimals != null) frac = frac.slice(0, decimals)
    return `${whole}.${frac}`
  }

  return (
    <Input
      data-allow-text=""
      inputMode={decimals === 0 ? "numeric" : "decimal"}
      autoComplete="off"
      value={value ?? ""}
      onChange={(e) => {
        const v = clean(e.target.value)
        onValueChange?.(v)
        if (onChange) { e.target.value = v; onChange(e) }
      }}
      className={cn(align === "right" && "tw:text-right", "tw:tabular-nums", className)}
      {...props}
    />
  )
}

export { NumberInput }
