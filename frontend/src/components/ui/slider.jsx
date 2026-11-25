import { cn } from "@/lib/utils"
import { Slider as SliderPrimitive } from "radix-ui"

/**
 * A range slider: value / defaultValue are arrays (one thumb per entry), onValueChange(values).
 * Recolour the filled part from outside with tw:[&_[data-slot=slider-range]]:bg-... and the thumb with
 * tw:[&_[data-slot=slider-thumb]]:border-...
 */
function Slider({ className, value, defaultValue, min = 0, max = 100, ...props }) {
  const thumbs = value ?? defaultValue ?? [min]

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      min={min}
      max={max}
      className={cn("tw:relative tw:flex tw:w-full tw:cursor-pointer tw:touch-none tw:items-center tw:py-1.5 tw:select-none tw:data-[disabled]:cursor-not-allowed tw:data-[disabled]:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="tw:relative tw:h-1.5 tw:w-full tw:grow tw:overflow-hidden tw:rounded-full tw:bg-input/40">
        <SliderPrimitive.Range data-slot="slider-range" className="tw:absolute tw:h-full tw:bg-primary" />
      </SliderPrimitive.Track>
      {thumbs.map((thumbValue, index) => (
        <SliderPrimitive.Thumb
          key={index}
          data-slot="slider-thumb"
          className="tw:block tw:size-4 tw:shrink-0 tw:rounded-full tw:border-2 tw:border-primary tw:bg-background tw:shadow-sm tw:outline-none tw:transition-[box-shadow] tw:focus-visible:ring-2 tw:focus-visible:ring-ring/40"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
