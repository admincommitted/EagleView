import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const ALIGN = { left: "tw:text-left", center: "tw:text-center", right: "tw:text-right tw:tabular-nums" }

const keyOf = (row, index, rowKey) => (typeof rowKey === "function" ? rowKey(row, index) : row[rowKey] ?? index)

/**
 * columns: [{ key, header, title, align, width, className, cell: (row, index) => content }]
 * selection: { keys, onToggle(key), onToggleAll() } adds a tick column.
 * rowClassName(row) colours a row (status); onRowContextMenu(row, event) for a right-click menu.
 */
function DataTable({
  columns,
  rows,
  rowKey = "id",
  selectedKey,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  rowClassName,
  rowTitle,
  selection,
  emptyText = "No rows",
  stickyHeader = true,
  className,
  containerClassName,
}) {
  const allTicked = rows.length > 0 && selection?.keys.length === rows.length

  return (
    <Table className={className} containerClassName={containerClassName}>
      <TableHeader sticky={stickyHeader}>
        <TableRow className="tw:hover:bg-transparent tw:even:bg-transparent">
          {selection && (
            <TableHead className="tw:w-[30px] tw:text-center">
              <Checkbox aria-label="Tick all" checked={allTicked} onCheckedChange={selection.onToggleAll} className="tw:border-white/80" />
            </TableHead>
          )}
          {columns.map((column) => (
            <TableHead key={column.key} title={column.title} className={cn(ALIGN[column.align], column.className)} style={column.width ? { width: column.width } : undefined}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const key = keyOf(row, index, rowKey)
          return (
            <TableRow
              key={key}
              data-state={key === selectedKey ? "selected" : undefined}
              aria-selected={key === selectedKey}
              title={rowTitle}
              onClick={onRowClick && (() => onRowClick(row, index))}
              onDoubleClick={onRowDoubleClick && (() => onRowDoubleClick(row, index))}
              onContextMenu={onRowContextMenu && ((event) => { event.preventDefault(); onRowContextMenu(row, event) })}
              className={cn((onRowClick || onRowDoubleClick) && "tw:cursor-pointer", rowClassName?.(row))}
            >
              {selection && (
                <TableCell className="tw:text-center" onClick={(event) => event.stopPropagation()}>
                  <Checkbox aria-label="Tick row" checked={selection.keys.includes(key)} onCheckedChange={() => selection.onToggle(key)} />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell key={column.key} className={cn(ALIGN[column.align], column.className)}>
                  {column.cell ? column.cell(row, index) : row[column.key]}
                </TableCell>
              ))}
            </TableRow>
          )
        })}
        {rows.length === 0 && (
          <TableRow className="tw:hover:bg-transparent">
            <TableCell colSpan={columns.length + (selection ? 1 : 0)} className="tw:py-4 tw:text-center tw:text-muted-foreground">
              {emptyText}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export { DataTable }
