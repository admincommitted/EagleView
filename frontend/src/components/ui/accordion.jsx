import { ChevronDown } from "lucide-react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

function Accordion(props) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({ className, ...props }) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn("tw:border-b tw:border-border tw:last:border-b-0", className)} {...props} />
}

function AccordionTrigger({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Header className="tw:flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "tw:flex tw:flex-1 tw:cursor-pointer tw:items-center tw:justify-between tw:gap-2 tw:border-0 tw:bg-transparent tw:px-3 tw:py-2.5 tw:text-left tw:text-entry tw:font-semibold tw:text-foreground tw:normal-case tw:outline-none tw:transition-colors tw:hover:bg-accent tw:focus-visible:bg-accent tw:[&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="tw:size-4 tw:shrink-0 tw:text-muted-foreground tw:transition-transform tw:duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="tw:overflow-hidden tw:data-[state=closed]:animate-accordion-up tw:data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("tw:pb-2", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
