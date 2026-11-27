// Parts for printed reports: the ui Table and page blocks with the paper look (black on white, fixed colours and sizes),
// the same on screen, in print, in the PDF file and in the e-mail, whatever the screen theme.
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui';
import { cellSpecOf } from './sections/reportFormat';

// below md the page keeps its paper width and scrolls sideways instead of squeezing the columns
export function ReportPage({ className, children }) {
  return (
    <div className="tw:overflow-x-auto tw:md:overflow-visible tw:print:overflow-visible">
      <div className={cn('tw:min-w-[720px] tw:bg-white tw:text-[9pt] tw:text-black tw:normal-case tw:[font-family:Helvetica,Arial,sans-serif] tw:md:min-w-0 tw:print:min-w-0', className)}>
        {children}
      </div>
    </div>
  );
}

export function ReportTitle({ className, children }) {
  return <div className={cn('tw:text-center tw:text-[12pt] tw:font-bold', className)}>{children}</div>;
}

export function ReportBand({ className, children }) {
  return <div className={cn('tw:bg-[#1e3a5f] tw:px-[6px] tw:py-[3px] tw:font-bold tw:text-white', className)}>{children}</div>;
}

const NOTE_TONES = {
  warn: 'tw:border-[#f59e0b] tw:bg-[#fffbeb] tw:text-[#92400e]',
  info: 'tw:border-[#93c5fd] tw:bg-[#eff6ff] tw:text-[#1e3a8a]',
};

export function ReportNote({ tone = 'warn', className, children }) {
  return (
    <div className={cn('no-print tw:mb-[6px] tw:border tw:border-solid tw:px-[8px] tw:py-[4px]', NOTE_TONES[tone], className)}>
      {children}
    </div>
  );
}

export function ReportFootnote({ className, children }) {
  return <div className={cn('tw:mt-[6px] tw:text-[8pt] tw:text-[#475569]', className)}>{children}</div>;
}

// letters take the size of the page; pass a tw:text-[..] class for a fixed size. A report keeps its paper layout on a
// phone too (no card view): ReportPage scrolls it sideways instead.
export function ReportTable({ className, containerClassName, ...props }) {
  return (
    <Table
      mobileCards={false}
      containerClassName={cn('tw:overflow-visible', containerClassName)}
      className={cn('tw:text-[length:inherit] tw:text-black', className)}
      {...props}
    />
  );
}

export function ColumnWidths({ widths }) {
  return (
    <colgroup>
      {widths.map((width, index) => <col key={index} style={{ '--col-w': `${width}%` }} className="tw:w-(--col-w)" />)}
    </colgroup>
  );
}

export function ReportTableHeader({ className, ...props }) {
  return <TableHeader className={cn('tw:bg-transparent tw:text-black', className)} {...props} />;
}

export function ReportBody({ className, ...props }) {
  return <TableBody className={cn('tw:bg-transparent', className)} {...props} />;
}

export function ReportTableFooter({ className, ...props }) {
  return <TableFooter className={cn('tw:bg-transparent tw:font-normal', className)} {...props} />;
}

const ROW_TONES = {
  plain: 'tw:bg-transparent tw:even:bg-transparent tw:hover:bg-transparent',
  total: 'tw:bg-[#f1f5f9] tw:even:bg-[#f1f5f9] tw:hover:bg-[#f1f5f9] tw:font-bold',
};

export function ReportRow({ tone = 'plain', className, ...props }) {
  return <TableRow className={cn('tw:border-0', ROW_TONES[tone], className)} {...props} />;
}

const SHEET_CELL = 'tw:h-auto tw:align-top tw:text-[length:inherit] tw:whitespace-normal tw:text-black';

// grid = dark ruled cell (the report sheets), plain = no lines (the BE checklist), bare = no lines and no padding,
// ruled = light ruled cell with roomy padding (the detailed BE checklist and the duty summary)
const CELL_LOOKS = {
  grid: `${SHEET_CELL} tw:border tw:border-solid tw:border-[#475569] tw:px-[5px] tw:py-[3px]`,
  plain: `${SHEET_CELL} tw:border-0 tw:px-[3px] tw:py-px`,
  bare: `${SHEET_CELL} tw:border-0 tw:p-0`,
  ruled: 'tw:border-[#cbd5e1] tw:p-[6px] tw:whitespace-normal',
};

const HEAD_LOOKS = {
  grid: `${CELL_LOOKS.grid} tw:bg-[#e2e8f0] tw:font-bold`,
  plain: `${CELL_LOOKS.plain} tw:bg-transparent tw:font-bold`,
  bare: `${CELL_LOOKS.bare} tw:bg-transparent tw:font-bold`,
  ruled: 'tw:h-auto tw:border-[#cbd5e1] tw:bg-transparent tw:p-[6px] tw:text-center tw:font-bold tw:whitespace-normal tw:text-inherit',
};

const ALIGN = { left: 'tw:text-left', right: 'tw:text-right', center: 'tw:text-center' };

export function ReportCell({ look = 'grid', align, className, ...props }) {
  return <TableCell className={cn(CELL_LOOKS[look], ALIGN[align], className)} {...props} />;
}

export function ReportHeadCell({ look = 'grid', align, className, ...props }) {
  return <TableHead className={cn(HEAD_LOOKS[look], ALIGN[align], className)} {...props} />;
}

export function ReportLabelCell({ className, ...props }) {
  return <ReportCell className={cn('tw:bg-[#f8fafc] tw:font-bold', className)} {...props} />;
}

// alignment follows the column the cell starts in
function GridCells({ cells, columns, rightAligned, className }) {
  let column = 0;
  return cells.map((cell, index) => {
    const spec = cellSpecOf(cell);
    const align = rightAligned.includes(columns[column]) ? 'right' : 'left';
    column += spec.colSpan || 1;
    return (
      <ReportCell key={index} align={align} colSpan={spec.colSpan} className={cn(className, spec.className)}>
        {spec.value}
      </ReportCell>
    );
  });
}

// A data grid: column headings, rows of cells (values or { value, colSpan, className }), an empty line and a total row.
export function ReportColumnGrid({ columns, rows, rightAligned = [], emptyText, footer, headTop, className, headClassName, cellClassName }) {
  return (
    <ReportTable className={className}>
      <ReportTableHeader>
        {headTop}
        <ReportRow>
          {columns.map((column) => (
            <ReportHeadCell key={column} align={rightAligned.includes(column) ? 'right' : 'left'} className={headClassName}>{column}</ReportHeadCell>
          ))}
        </ReportRow>
      </ReportTableHeader>
      <ReportBody>
        {rows.map((cells, index) => (
          <ReportRow key={index}>
            <GridCells cells={cells} columns={columns} rightAligned={rightAligned} className={cellClassName} />
          </ReportRow>
        ))}
        {rows.length === 0 && (
          <ReportRow>
            <ReportCell colSpan={columns.length} align="center" className={cellClassName}>{emptyText}</ReportCell>
          </ReportRow>
        )}
      </ReportBody>
      {footer && rows.length > 0 && (
        <ReportTableFooter>
          <ReportRow tone="total">
            <GridCells cells={footer} columns={columns} rightAligned={rightAligned} className={cellClassName} />
          </ReportRow>
        </ReportTableFooter>
      )}
    </ReportTable>
  );
}

export function ReportSectionHeader({ title, colSpan = 2 }) {
  return (
    <ReportRow>
      <ReportCell look="ruled" colSpan={colSpan} className="tw:border-0 tw:bg-[#1e3a5f] tw:px-[10px] tw:py-[6px] tw:text-[12px] tw:font-bold tw:tracking-[0.5px] tw:text-white tw:uppercase">
        {title}
      </ReportCell>
    </ReportRow>
  );
}

export function ReportFieldRow({ label, value }) {
  return (
    <ReportRow>
      <ReportCell look="ruled" className="tw:w-[35%] tw:bg-[#f8fafc] tw:px-[8px] tw:py-[5px] tw:text-[11px] tw:font-semibold tw:text-[#334155]">{label}</ReportCell>
      <ReportCell look="ruled" className="tw:px-[8px] tw:py-[5px] tw:text-[11px]">{value || <span className="tw:text-[#94a3b8]">—</span>}</ReportCell>
    </ReportRow>
  );
}

// fields: [[label, value], ...]; children: extra rows after the fields
export function ReportFieldTable({ title, fields, children, className }) {
  return (
    <ReportTable className={cn('tw:mb-6 tw:text-[11px]', className)}>
      <ReportBody>
        {title && <ReportSectionHeader title={title} />}
        {fields.map(([label, value]) => <ReportFieldRow key={label} label={label} value={value} />)}
        {children}
      </ReportBody>
    </ReportTable>
  );
}

// A titled grid: the section heading bar, then the column headings and the rows (children), or "No records".
export function ReportSectionGrid({ title, headers, isEmpty, children }) {
  return (
    <div className="tw:mb-6">
      <ReportTable className="tw:text-[11px]">
        <ReportBody>
          <ReportSectionHeader title={title} />
        </ReportBody>
      </ReportTable>
      <ReportTable className="tw:mt-1 tw:text-[11px]">
        <ReportTableHeader className="tw:bg-[#f8fafc] tw:text-[#334155]">
          <ReportRow>
            {headers.map((header) => <ReportHeadCell look="ruled" key={header}>{header}</ReportHeadCell>)}
          </ReportRow>
        </ReportTableHeader>
        <ReportBody>
          {isEmpty
            ? <ReportRow><ReportCell look="ruled" colSpan={headers.length} className="tw:text-center">No records</ReportCell></ReportRow>
            : children}
        </ReportBody>
      </ReportTable>
    </div>
  );
}
