import { useEffect, useRef } from 'react';
import { cn } from "@/lib/utils"

// below this width a table shows each row as a card: the column name on the left, the value on the right
const CARD_VIEW_QUERY = "screen and (max-width: 767.98px)"

// the name of every column, read from the header rows (spanned header cells counted; the lowest named row wins)
function columnNames(table) {
  const names = []
  const taken = []
  Array.from(table.tHead?.rows || []).forEach((row, rowIndex) => {
    let column = 0
    for (const cell of row.cells) {
      while (taken[rowIndex]?.[column]) column += 1
      const text = cell.textContent.trim()
      for (let down = 0; down < cell.rowSpan; down += 1) {
        for (let across = 0; across < cell.colSpan; across += 1) {
          (taken[rowIndex + down] ||= [])[column + across] = true
          if (text) names[column + across] = text
        }
      }
      column += cell.colSpan
    }
  })
  return names
}

const setAttr = (element, name, value) => {
  if (value == null) element.removeAttribute(name)
  else if (element.getAttribute(name) !== value) element.setAttribute(name, value)
}

const CONTROLS = 'button, a, [role="button"], [role="checkbox"], input[type="checkbox"]'
const TEXT_BOXES = 'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea, select, [role="combobox"]'
const bareText = (text) => text.replace(/\s+/g, "")
// longer than this a button reads as a value (a status such as UN-REGISTERED) and keeps its line and label
const ACTION_TEXT_MAX = 4

// a cell holding only icon / letter buttons or a tick (Edit, Delete, F L G): the card puts these side by side on one line
function isActionCell(cell) {
  const controls = cell.querySelectorAll(CONTROLS)
  if (!controls.length || cell.querySelector(TEXT_BOXES)) return false
  const controlTexts = Array.from(controls, (control) => bareText(control.textContent))
  if (controlTexts.some((text) => text.length > ACTION_TEXT_MAX)) return false
  return bareText(cell.textContent).length <= controlTexts.join("").length
}

// nothing to read and nothing to use: the card leaves the line out
const isEmptyCell = (cell) => !bareText(cell.textContent) && !cell.querySelector(`${CONTROLS}, ${TEXT_BOXES}, img, svg`)

function labelCells(table) {
  const names = columnNames(table)
  const rows = [...Array.from(table.tBodies).flatMap((body) => Array.from(body.rows)), ...Array.from(table.tFoot?.rows || [])]
  for (const row of rows) {
    let column = 0
    for (const cell of row.cells) {
      const wide = cell.colSpan > 1
      const action = !wide && isActionCell(cell)
      setAttr(cell, "data-label", wide ? null : names[column] || "")
      setAttr(cell, "data-wide", wide ? "" : null)
      setAttr(cell, "data-action", action ? "" : null)
      setAttr(cell, "data-empty", !wide && isEmptyCell(cell) ? "" : null)
      if (action && !cell.title && names[column]) cell.title = names[column]
      column += cell.colSpan
    }
  }
}

// keeps the cell labels in step with the rows while the card view is showing
function useCardLabels(tableRef, enabled) {
  useEffect(() => {
    const table = tableRef.current
    if (!enabled || !table) return undefined
    const media = window.matchMedia(CARD_VIEW_QUERY)
    let observer = null
    let frame = 0
    const relabel = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => labelCells(table))
    }
    const follow = () => {
      if (media.matches && !observer) {
        labelCells(table)
        observer = new MutationObserver(relabel)
        observer.observe(table, { childList: true, subtree: true, characterData: true })
      } else if (!media.matches && observer) {
        observer.disconnect()
        observer = null
      }
    }
    follow()
    media.addEventListener("change", follow)
    return () => {
      media.removeEventListener("change", follow)
      observer?.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [tableRef, enabled])
}

// mobileCards={false} keeps the grid on a phone too (a matrix that only reads as a grid)
function Table({ className, containerClassName, mobileCards = true, ...props }) {
  const tableRef = useRef(null)
  useCardLabels(tableRef, mobileCards)
  return (
    <div data-slot="table-container" className={cn("tw:relative tw:w-full tw:overflow-auto", containerClassName)}>
      <table
        ref={tableRef}
        data-slot="table"
        data-cards={mobileCards ? "" : undefined}
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
        "tw:border-b tw:border-border/50 tw:transition-none tw:even:bg-muted tw:hover:bg-accent/60 tw:data-[state=selected]:bg-accent tw:data-[state=selected]:font-semibold",
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
      className={cn("tw:border tw:border-border/50 tw:px-2 tw:py-1 tw:align-middle tw:whitespace-nowrap", className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }) {
  return <caption data-slot="table-caption" className={cn("tw:mt-2 tw:text-[11px] tw:text-muted-foreground", className)} {...props} />
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
