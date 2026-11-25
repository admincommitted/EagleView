// Parts of the S/B checklist (iCAFFE layout): black on white, borderless cells in small letters (8px on the screen and
// in the PDF file, 9px printed, next to the 9.5px text), blocks kept together on a page.
import { cn } from '@/lib/utils';
import { cellSpecOf } from '../../../JobEntry/Tabs/ReportTabParts/sections/reportFormat';
import { ReportBody, ReportCell, ReportHeadCell, ReportRow, ReportTable, ReportTableHeader } from '../../../JobEntry/Tabs/ReportTabParts/reportTable';

const CELL = 'tw:px-[2px] tw:py-px tw:text-[8px] tw:break-words tw:print:px-[3px] tw:print:text-[9px]';
// field = the label / value cells; line = the upper-case cells of the lists and totals
const CELL_LOOKS = { field: CELL, line: `${CELL} tw:uppercase` };
export const KEEP_TOGETHER = 'section-avoid-break tw:print:break-inside-avoid';
export const RULED_HEAD = 'tw:border-y tw:border-solid tw:border-black';
export const DASHED_HEAD = 'tw:border-b tw:border-dashed tw:border-black';

export function CheckCell({ look = 'field', className, ...props }) {
  return <ReportCell look="plain" className={cn(CELL_LOOKS[look], className)} {...props} />;
}

export function CheckHeadCell({ look = 'field', className, ...props }) {
  return <ReportHeadCell look="plain" align="left" className={cn(CELL_LOOKS[look], className)} {...props} />;
}

export function CheckTable({ className, ...props }) {
  return <ReportTable className={cn('tw:mb-[8px]', className)} {...props} />;
}

export function CheckRule({ thick = false, className }) {
  return <hr className={cn('tw:my-[8px] tw:border-0 tw:border-t tw:border-solid tw:border-black', thick && 'tw:border-t-4', className)} />;
}

export function CheckSectionTitle({ className, children }) {
  return (
    <div className={cn('tw:mt-[15px] tw:mb-[5px] tw:border-b tw:border-dashed tw:border-black tw:pb-[2px] tw:text-[11px] tw:font-bold tw:text-black tw:capitalize', className)}>
      {children}
    </div>
  );
}

// rows of cells (label, value, label, value ...); a cell can be { value, colSpan, look, className }
export function CheckFieldTable({ rows }) {
  return (
    <CheckTable>
      <ReportBody>
        {rows.map((cells, rowIndex) => (
          <ReportRow key={rowIndex}>
            {cells.map((cell, cellIndex) => {
              const spec = cellSpecOf(cell);
              return <CheckCell key={cellIndex} look={spec.look} colSpan={spec.colSpan} className={spec.className}>{spec.value}</CheckCell>;
            })}
          </ReportRow>
        ))}
      </ReportBody>
    </CheckTable>
  );
}

// A titled list kept on one page: heading row, one row per record (cells as in CheckFieldTable), an empty line and a
// total line under the rows.
export function CheckListSection({ title, headings, headClassName = RULED_HEAD, rows, cellLook = 'field', cellClassName, emptyText, totalText }) {
  return (
    <div className={KEEP_TOGETHER}>
      <CheckSectionTitle>{title}</CheckSectionTitle>
      <CheckTable>
        <ReportTableHeader>
          <ReportRow className={headClassName}>
            {headings.map((heading, index) => <CheckHeadCell key={index}>{heading}</CheckHeadCell>)}
          </ReportRow>
        </ReportTableHeader>
        <ReportBody>
          {rows.map((cells, rowIndex) => (
            <ReportRow key={rowIndex}>
              {cells.map((cell, cellIndex) => {
                const spec = cellSpecOf(cell);
                return <CheckCell key={cellIndex} look={cellLook} className={cn(cellClassName, spec.className)}>{spec.value}</CheckCell>;
              })}
            </ReportRow>
          ))}
          {rows.length === 0 && (
            <ReportRow>
              <CheckCell look="line" colSpan={headings.length} align="center">{emptyText}</CheckCell>
            </ReportRow>
          )}
          {totalText && (
            <ReportRow>
              <CheckCell colSpan={headings.length} align="right" className="tw:border-t tw:border-solid tw:border-black tw:font-bold">{totalText}</CheckCell>
            </ReportRow>
          )}
        </ReportBody>
      </CheckTable>
    </div>
  );
}

// "LABEL: value" pairs spread over one line
export function CheckFactLine({ facts, className }) {
  return (
    <div className={cn('tw:flex tw:justify-between tw:py-[4px]', className)}>
      {facts.map(([label, value]) => (
        <span key={label}><strong>{label}</strong>{value !== undefined && <> {value}</>}</span>
      ))}
    </div>
  );
}
