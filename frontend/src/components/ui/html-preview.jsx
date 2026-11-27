import { cn } from "@/lib/utils"

const PREVIEW_STYLE = "<style>body{margin:8px;font:13px/1.5 system-ui,sans-serif;color:#0f172a;word-wrap:break-word}</style>"

/**
 * Shows an HTML document (an e-mail template, a mail about to be sent) as it will look, inside a sandboxed frame:
 * the HTML keeps its layout and styles, but nothing in it can run script or reach the app (or its login token).
 */
function HtmlPreview({ html, title = "Preview", className }) {
  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={PREVIEW_STYLE + (html || "")}
      className={cn("tw:block tw:h-80 tw:w-full tw:rounded-md tw:border-0 tw:bg-white", className)}
    />
  )
}

export { HtmlPreview }
