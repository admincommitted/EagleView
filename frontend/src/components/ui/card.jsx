import { cn } from "@/lib/utils"

function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn("tw:flex tw:min-w-0 tw:flex-col tw:rounded-lg tw:border tw:border-border tw:bg-card tw:text-entry tw:text-card-foreground", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }) {
  return (
    <div
      data-slot="card-header"
      className={cn("tw:flex tw:items-center tw:justify-between tw:gap-2 tw:px-3 tw:pt-2.5 tw:pb-1.5", className)}
      {...props}
    />
  )
}

function CardTitle({ className, icon, children, ...props }) {
  return (
    <h3
      data-slot="card-title"
      className={cn("tw:m-0 tw:flex tw:items-center tw:gap-1.5 tw:text-entry tw:font-bold tw:tracking-normal tw:text-head tw:[&_svg]:size-3.5 tw:[&_svg]:shrink-0", className)}
      {...props}
    >
      {icon}
      {children}
    </h3>
  )
}

function CardDescription({ className, ...props }) {
  return <p data-slot="card-description" className={cn("tw:m-0 tw:text-[11px] tw:text-muted-foreground", className)} {...props} />
}

function CardAction({ className, ...props }) {
  return <div data-slot="card-action" className={cn("tw:ml-auto tw:flex tw:items-center tw:gap-1.5", className)} {...props} />
}

function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn("tw:flex tw:min-w-0 tw:flex-col tw:gap-2 tw:px-3 tw:pb-3", className)} {...props} />
}

function CardFooter({ className, ...props }) {
  return <div data-slot="card-footer" className={cn("tw:flex tw:items-center tw:gap-1.5 tw:border-t tw:border-border tw:px-3 tw:py-2", className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter }
