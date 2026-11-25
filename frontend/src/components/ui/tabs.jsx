"use client"

import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "tw:group/tabs tw:flex tw:gap-0 tw:data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "tw:group/tabs-list tw:inline-flex tw:items-end tw:text-muted-foreground tw:group-data-[orientation=vertical]/tabs:h-fit tw:group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        entry: "tw:w-full tw:justify-start tw:gap-[3px] tw:border-b-2 tw:border-primary tw:bg-transparent tw:p-0",
        pill: "tw:w-fit tw:justify-center tw:rounded-lg tw:bg-muted tw:p-[3px] tw:group-data-[orientation=horizontal]/tabs:h-8",
        line: "tw:w-fit tw:gap-1 tw:rounded-none tw:bg-transparent",
      },
    },
    defaultVariants: {
      variant: "entry",
    },
  }
)

function TabsList({
  className,
  variant = "entry",
  ...props
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "tw:relative tw:inline-flex tw:items-center tw:justify-center tw:gap-1.5 tw:border tw:border-transparent tw:px-3 tw:text-entry tw:font-normal tw:whitespace-nowrap tw:normal-case tw:shadow-none tw:filter-none tw:transition-colors tw:outline-none tw:cursor-pointer tw:focus-visible:ring-2 tw:focus-visible:ring-ring/40 tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*=size-])]:size-3.5",
        "tw:group-data-[variant=entry]/tabs-list:h-[30px] tw:group-data-[variant=entry]/tabs-list:rounded-t-[5px] tw:group-data-[variant=entry]/tabs-list:rounded-b-none tw:group-data-[variant=entry]/tabs-list:border-b-0 tw:group-data-[variant=entry]/tabs-list:border-primary/20 tw:group-data-[variant=entry]/tabs-list:bg-primary/10 tw:group-data-[variant=entry]/tabs-list:text-foreground tw:group-data-[variant=entry]/tabs-list:hover:bg-primary/20 tw:group-data-[variant=entry]/tabs-list:hover:text-head",
        "tw:group-data-[variant=entry]/tabs-list:data-[state=active]:border-primary tw:group-data-[variant=entry]/tabs-list:data-[state=active]:bg-primary tw:group-data-[variant=entry]/tabs-list:data-[state=active]:font-semibold tw:group-data-[variant=entry]/tabs-list:data-[state=active]:text-primary-foreground",
        "tw:group-data-[variant=pill]/tabs-list:h-[calc(100%-1px)] tw:group-data-[variant=pill]/tabs-list:flex-1 tw:group-data-[variant=pill]/tabs-list:rounded-md tw:group-data-[variant=pill]/tabs-list:px-2 tw:group-data-[variant=pill]/tabs-list:text-foreground/60 tw:group-data-[variant=pill]/tabs-list:data-[state=active]:bg-background tw:group-data-[variant=pill]/tabs-list:data-[state=active]:text-foreground tw:group-data-[variant=pill]/tabs-list:data-[state=active]:shadow-sm",
        "tw:group-data-[variant=line]/tabs-list:h-8 tw:group-data-[variant=line]/tabs-list:bg-transparent tw:group-data-[variant=line]/tabs-list:text-foreground/60 tw:group-data-[variant=line]/tabs-list:data-[state=active]:text-foreground tw:after:absolute tw:after:inset-x-0 tw:after:bottom-[-1px] tw:after:h-0.5 tw:after:bg-primary tw:after:opacity-0 tw:group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("tw:flex-1 tw:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
