import { Children, cloneElement, isValidElement, useId } from 'react';
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { InfoTip } from "@/components/ui/info-tip"

function Field({
  label,
  htmlFor,
  required,
  hint,
  note,
  layout = "row",
  labelWidth,
  className,
  labelClassName,
  children,
}) {
  const autoId = useId()
  const id = htmlFor || autoId
  const kids = Children.toArray(children)
  const first = kids[0]
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
