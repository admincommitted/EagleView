import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

const toDate = (ymd) => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ""))
  if (!parts) return null
  const date = new Date(+parts[1], +parts[2] - 1, +parts[3])
  return isNaN(date) ? null : date
}

const twoDigits = (number) => String(number).padStart(2, "0")
const toYmd = (date) => (!date || isNaN(date) ? "" : `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`)

function CalendarBox({ className, ...props }) {
  return (
    <div className="tw:relative tw:w-full">
      <Input className={cn("tw:pr-6", className)} {...props} />
      <CalendarDays className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:right-1.5 tw:size-3.5 tw:-translate-y-1/2 tw:text-muted-foreground" />
    </div>
  )
}

function DateInput({
  value,
  onValueChange,
  onChange,
  id,
  name,
  required,
  disabled,
  readOnly,
  placeholder = "DD-MM-YYYY",
  minDate,
  maxDate,
  className,
  wrapperClassName,
}) {
  const changeDate = (date) => {
    const ymd = toYmd(date)
    onValueChange?.(ymd)
    onChange?.({ target: { name, value: ymd } })
  }

  return (
    <div className={cn("tw:w-full tw:min-w-0 tw:[&_.react-datepicker-wrapper]:block", wrapperClassName)}>
      <DatePicker
        selected={toDate(value)}
        onChange={changeDate}
        dateFormat="dd-MM-yyyy"
        placeholderText={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        minDate={toDate(minDate) || undefined}
        maxDate={toDate(maxDate) || undefined}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        wrapperClassName="tw:block tw:w-full"
        popperClassName="tw:z-[10001]"
        id={id}
        customInput={<CalendarBox required={required} className={className} />}
      />
      {name && <input type="hidden" name={name} value={value || ""} />}
    </div>
  )
}

export { DateInput, toYmd, toDate }
