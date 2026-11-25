import { cn } from "@/lib/utils"

function Section({ title, actions, className, bodyClassName, children }) {
  return (
    <section data-slot="section" className={cn("tw:flex tw:min-w-0 tw:flex-col tw:gap-1.5", className)}>
      {(title || actions) && (
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border tw:px-0.5 tw:pb-px">
          <h4 className="tw:m-0 tw:text-entry tw:font-semibold tw:tracking-normal tw:normal-case tw:text-head">{title}</h4>
          {actions && <div className="tw:flex tw:items-center tw:gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={cn("tw:flex tw:min-w-0 tw:flex-col tw:gap-1.5", bodyClassName)}>{children}</div>
    </section>
  )
}

export { Section }
