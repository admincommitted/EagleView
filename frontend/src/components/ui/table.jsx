import { cn } from "@/lib/utils"

function Table({ className, containerClassName, ...props }) {
  return (
    <div data-slot="table-container" className={cn("tw:relative tw:w-full tw:overflow-auto", containerClassName)}>
      <table
        data-slot="table"
        className={cn("no-grid tw:w-full tw:border-collapse tw:text-[11px] tw:text-foreground", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, sticky, ...props }) {
  return (
    <thead
      data-slot="table-header"
      className={cn("tw:bg-primary tw:text-primary-foreground", sticky && "tw:sticky tw:top-0 tw:z-[1]", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }) {
  return <tbody data-slot="table-body" className={cn("tw:bg-background", className)} {...props} />
}

function TableFooter({ className, ...props }) {
  return <tfoot data-slot="table-footer" className={cn("tw:bg-page tw:font-semibold", className)} {...props} />
}

function TableRow({ className, ...props }) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "tw:border-b tw:border-border tw:transition-none tw:even:bg-muted tw:hover:bg-accent/60 tw:data-[state=selected]:bg-accent tw:data-[state=selected]:font-semibold",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "tw:h-7 tw:border tw:border-primary/40 tw:bg-primary tw:px-2 tw:py-1 tw:text-left tw:align-middle tw:text-[11px] tw:font-semibold tw:whitespace-nowrap tw:text-primary-foreground",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }) {
  return (
    <td
      data-slot="table-cell"
      className={cn("tw:border tw:border-border tw:px-2 tw:py-1 tw:align-middle tw:whitespace-nowrap", className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }) {
  return <caption data-slot="table-caption" className={cn("tw:mt-2 tw:text-[11px] tw:text-muted-foreground", className)} {...props} />
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
