import { Fragment, isValidElement } from 'react';
import { cn } from '@/lib/utils';
import { BOX, Caption, DocCheck, DocInput, DocTextarea, DocWindow, Letterhead, SheetBody, SheetCell, SheetHead, SheetHeader, SheetRow, SheetTable, Sign } from './docKit';

/**
 * One AWB document window built from a description of its sheet:
 *   sheet = { title, filePrefix, landscape, frameClassName, blocks(doc, awbNumber) => [block | element] }
 * blocks:
 *   { kind: 'letterhead', small }                     { kind: 'title', text, className }   { kind: 'subtitle', text, className }
 *   { kind: 'fields', rows: [[cell]], className }     { kind: 'grid', columns: [{ header, className }], rows: [[cell]], className, headClassName }
 *   { kind: 'text', label, name, value, lines, className }
 *   { kind: 'checks', label, items: [{ name, checked, label }], stacked, after, className }
 *   { kind: 'note', text, className }                 { kind: 'sign', left, right }
 * cell: { label, name, value, lines (a text box of n lines), colSpan, rowSpan, className, more: [field], moreGap, content }
 * A plain React element in blocks is drawn as it is.
 */
function DocField({ field }) {
  return field.lines
    ? <DocTextarea name={field.name} value={field.value} lines={field.lines} />
    : <DocInput name={field.name} value={field.value} />;
}

function DocCell({ cell }) {
  const { label, name, colSpan, rowSpan, className, more = [], moreGap = 'tw:mt-[6px]', content } = cell;
  return (
    <SheetCell colSpan={colSpan} rowSpan={rowSpan} className={className}>
      {label && <Caption>{label}</Caption>}
      {name && <DocField field={cell} />}
      {more.map((field) => (
        <Fragment key={field.name}>
          <Caption className={moreGap}>{field.label}</Caption>
          <DocField field={field} />
        </Fragment>
      ))}
      {content}
    </SheetCell>
  );
}

function CellRows({ rows }) {
  return rows.map((row, rowIndex) => (
    <SheetRow key={rowIndex}>{row.map((cell, cellIndex) => <DocCell key={cellIndex} cell={cell} />)}</SheetRow>
  ));
}

const BLOCKS = {
  letterhead: ({ block, doc }) => <Letterhead company={doc.company} small={block.small} />,
  title: ({ block }) => (
    <h1 className={cn('tw:m-0 tw:mb-[2px] tw:text-center tw:text-[17px] tw:font-bold tw:tracking-[0.5px]', block.className)}>{block.text}</h1>
  ),
  subtitle: ({ block }) => <div className={cn('tw:mb-[10px] tw:text-center tw:text-[10px]', block.className)}>{block.text}</div>,
  fields: ({ block }) => (
    <SheetTable className={block.className}><SheetBody><CellRows rows={block.rows} /></SheetBody></SheetTable>
  ),
  grid: ({ block }) => (
    <SheetTable className={block.className}>
      <SheetHeader>
        <SheetRow>{block.columns.map((column) => <SheetHead key={column.header} className={cn(block.headClassName, column.className)}>{column.header}</SheetHead>)}</SheetRow>
      </SheetHeader>
      <SheetBody><CellRows rows={block.rows} /></SheetBody>
    </SheetTable>
  ),
  text: ({ block }) => (
    <div className={block.className}>
      <Caption>{block.label}</Caption>
      <DocTextarea name={block.name} value={block.value} lines={block.lines} />
    </div>
  ),
  checks: ({ block }) => (
    <div className={cn(BOX, block.className)}>
      <Caption>{block.label}</Caption>
      {block.items.map((item) => (block.stacked
        ? <div key={item.name}><DocCheck {...item} /></div>
        : <DocCheck key={item.name} {...item} />))}
      {block.after}
    </div>
  ),
  note: ({ block }) => <p className={cn('tw:mt-[10px] tw:text-[10px]', block.className)}>{block.text}</p>,
  sign: ({ block }) => <Sign left={block.left} right={block.right} />,
};

function DocBlocks({ blocks, doc }) {
  return blocks.filter(Boolean).map((block, index) => {
    if (isValidElement(block)) return <Fragment key={index}>{block}</Fragment>;
    const Block = BLOCKS[block.kind];
    return <Block key={index} block={block} doc={doc} />;
  });
}

export default function DocumentModal({ sheet, isOpen, onClose, awbNumber, awbId, awbType, extraButtons }) {
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title={sheet.title} fileName={`${sheet.filePrefix}_${awbNumber || ''}`}
      awbId={awbId} awbType={awbType} landscape={sheet.landscape} extraButtons={extraButtons}>
      {(doc) => {
        const blocks = <DocBlocks blocks={sheet.blocks(doc, awbNumber)} doc={doc} />;
        return sheet.frameClassName ? <div className={sheet.frameClassName}>{blocks}</div> : blocks;
      }}
    </DocWindow>
  );
}
