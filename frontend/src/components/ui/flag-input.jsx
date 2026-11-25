import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

function FlagInput({
  allowed = "YN",
  value,
  onValueChange,
  onChange,
  onKeyDown,
  onFocus,
  className,
  placeholder,
  ...props
}) {
  const ok = String(allowed).toUpperCase()
  const pick = (text) => {
    const letters = String(text || "").toUpperCase().split("").filter((ch) => ok.includes(ch))
    return letters.length ? letters[letters.length - 1] : ""
  }

  return (
    <Input
      data-allow-text=""
      autoComplete="off"
      maxLength={2}
      value={value ?? ""}
      placeholder={placeholder ?? ok.split("").join("/")}
      title={props.title ?? `Type ${ok.split("").join(", ")}`}
      onFocus={(e) => { e.target.select(); onFocus?.(e) }}
      onKeyDown={(e) => {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !ok.includes(e.key.toUpperCase())) e.preventDefault()
        onKeyDown?.(e)
      }}
      onChange={(e) => {
        const v = pick(e.target.value)
        onValueChange?.(v)
        if (onChange) { e.target.value = v; onChange(e) }
      }}
      className={cn("tw:w-10 tw:px-0 tw:text-center tw:font-semibold tw:uppercase", className)}
      {...props}
    />
  )
}

export { FlagInput }
