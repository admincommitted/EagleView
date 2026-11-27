import { Children, cloneElement, isValidElement, useId, useLayoutEffect, useRef } from 'react';
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { InfoTip } from "@/components/ui/info-tip"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { PasswordInput } from "@/components/ui/password-input"
import { DateInput } from "@/components/ui/date-input"
import { ComboInput } from "@/components/ui/combo-input"
import { SelectBox } from "@/components/ui/select-box"
import { SearchSelect } from "@/components/ui/search-select"
import { MultiSelect } from "@/components/ui/multi-select"
import { Textarea } from "@/components/ui/textarea"

// The label sits inside the box and moves up onto its border on focus or once the box has a value.
// Set to false to go back to labels beside / above the boxes everywhere; a single Field can opt out with floatLabel={false}.
const FLOATING_LABELS = true

const FLOATING_CONTROLS = new Set([Input, NumberInput, PasswordInput, DateInput, ComboInput, SelectBox, SearchSelect, MultiSelect, Textarea])
const TYPED_CONTROLS = new Set([Input, NumberInput, PasswordInput, ComboInput, Textarea])
// a box narrower than this cannot hold its label (Y/N flags, codes): it keeps the label beside it
const MIN_FLOATING_WIDTH_PX = 80
const TAILWIND_STEP_PX = 4
const WIDTH_CLASS = /(?:^|\s)tw:(?:sm:|md:|lg:)?w-(?:(\d+(?:\.\d+)?)|\[(\d+)px\])(?=\s|$)/g

function declaredWidthPx(className = "") {
  const widths = [...String(className).matchAll(WIDTH_CLASS)].map(([, steps, pixels]) => (pixels ? Number(pixels) : Number(steps) * TAILWIND_STEP_PX))
  return widths.length ? Math.max(...widths) : null
}

function canFloat(control, label) {
  if (!FLOATING_LABELS || label == null || !isValidElement(control)) return false
  // a screen's own wrapper around one of these boxes opts in with `Wrapper.floatsLabel = true`
  if (!FLOATING_CONTROLS.has(control.type) && !control.type?.floatsLabel) return false
  const { maxLength, className } = control.props
  if (maxLength && maxLength <= 2) return false
  const width = declaredWidthPx(className)
  return width === null || width >= MIN_FLOATING_WIDTH_PX
}

// :placeholder-shown tells an empty box from a filled one, so a typed box always gets a (blank) placeholder
const withFloatingProps = (control, id) => cloneElement(control, {
  id: control.props.id ?? id,
  ...(TYPED_CONTROLS.has(control.type) && !control.props.placeholder && { placeholder: " " }),
})

// boxes inside a screen's own wrapper may have no placeholder; a blank one lets :placeholder-shown see they are empty
const TYPED_BOX = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([placeholder]), textarea:not([placeholder])'

function useBlankPlaceholders(wrapperRef) {
  useLayoutEffect(() => {
    wrapperRef.current?.querySelectorAll(TYPED_BOX).forEach((box) => box.setAttribute("placeholder", " "))
  })
}

function FloatingField({ id, label, required, hint, note, className, labelClassName, controls }) {
  const [first, ...rest] = controls
  const wrapperRef = useRef(null)
  useBlankPlaceholders(wrapperRef)
  return (
    <div data-slot="field" data-floating="" className={cn("tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5 tw:pt-2", className)}>
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-1.5">
        <div ref={wrapperRef} className={cn("float-field tw:relative tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-1.5", first.props.leftIcon && "float-field-icon", first.type === Textarea && "float-field-area")}>
          {withFloatingProps(first, id)}
          {rest}
          <Label htmlFor={id} required={required} className={cn("float-label", labelClassName)}>{label}</Label>
        </div>
        {hint && <InfoTip>{hint}</InfoTip>}
      </div>
      {note && <p className="tw:m-0 tw:text-[11px] tw:leading-4 tw:text-muted-foreground">{note}</p>}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  note,
  layout = "row",
  labelWidth,
  floatLabel = true,
  className,
  labelClassName,
  children,
}) {
  const autoId = useId()
  const id = htmlFor || autoId
  const kids = Children.toArray(children)
  const first = kids[0]

  if (floatLabel && canFloat(first, label)) {
    return <FloatingField id={id} label={label} required={required} hint={hint} note={note} className={className} labelClassName={labelClassName} controls={kids} />
  }

  const control =
    isValidElement(first) && first.props.id === undefined
      ? [cloneElement(first, { id }), ...kids.slice(1)]
      : kids

  return (
    <div
      data-slot="field"
      className={cn(
        "tw:flex tw:min-w-0",
        layout === "row"
          ? "tw:flex-col tw:items-stretch tw:gap-0.5 tw:md:flex-row tw:md:items-center tw:md:gap-2"
          : "tw:flex-col tw:gap-0.5",
        className
      )}
    >
      {label != null && (
        <Label
          htmlFor={id}
          required={required}
          className={cn(layout === "row" && "tw:shrink-0", labelWidth && "tw:md:w-(--label-w)", labelClassName)}
          style={labelWidth ? { "--label-w": labelWidth } : undefined}
        >
          {label}
        </Label>
      )}
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-0.5">
        <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-1.5">
          {control}
          {hint && <InfoTip>{hint}</InfoTip>}
        </div>
        {note && <p className="tw:m-0 tw:text-[11px] tw:leading-4 tw:text-muted-foreground">{note}</p>}
      </div>
    </div>
  )
}

export { Field }
