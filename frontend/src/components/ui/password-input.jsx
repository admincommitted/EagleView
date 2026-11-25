import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function PasswordInput({ className, wrapperClassName, ...props }) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye
  return (
    <div data-slot="password-input" className={cn("tw:relative tw:flex tw:min-w-0 tw:flex-1 tw:items-center", wrapperClassName)}>
      <Input type={visible ? "text" : "password"} data-allow-text className={cn("tw:pr-6", className)} {...props} />
      <Button
        variant="ghost"
        size="icon-sm"
        tabIndex={-1}
        aria-label={visible ? "Hide" : "Show"}
        className="tw:absolute tw:right-0 tw:text-muted-foreground tw:hover:bg-transparent"
        onClick={() => setVisible((shown) => !shown)}
      >
        <Icon />
      </Button>
    </div>
  )
}

export { PasswordInput }
