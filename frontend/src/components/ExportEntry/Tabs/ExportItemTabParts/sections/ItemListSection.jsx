import { Edit2, FileSpreadsheet, FileText, PlusCircle, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { perUnit } from '@/utils/cbicExchange';
import { Button, FileButton, Input, NumberInput, SelectBox, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { invoiceSerialOf } from '../itemForm';

const CONTROL_SELECTOR = 'button, input, select, svg, [role="combobox"]';
const PMV_TYPES = ['%', 'M'];

function SearchButton({ title, onClick }) {
  return <Button variant="ghost" size="icon-sm" tabIndex={-1} title={title} aria-label={title} onClick={onClick}><Search /></Button>;
}

function itemColumns(ctx) {
  const { openItem, deleteListedItem, updateItem, openSchemeSearch, openRitcSearch, showCcr } = ctx;
  return [
    {
      key: 'actions', header: 'Actions', headClassName: 'tw:w-[60px]',
      cell: (item, index) => (
        <span className="tw:inline-flex tw:gap-1">
          <Button variant="ghost" size="icon-sm" title="Edit Item Details in Form" aria-label="Edit item" onClick={() => openItem(item)}><Edit2 /></Button>
          <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Delete Item" aria-label="Delete item" onClick={() => deleteListedItem(item, index)}><Trash2 /></Button>
        </span>
      ),
    },
    { key: 'invSr', header: 'Inv Sr', align: 'center', cell: (item) => item.invSr || 1 },
    { key: 'itemSr', header: 'Item Sr', align: 'center', cell: (item, index) => item.itemSr || index + 1 },
    {
      key: 'scheme', header: 'Scheme Code',
      cell: (item) => (
        <span className="tw:flex tw:w-[120px] tw:items-center tw:gap-0.5">
          <Input data-allow-text="" value={item.scheme || ''} onChange={(event) => updateItem(item.id, 'scheme', event.target.value)} />
          <SearchButton title="Search scheme codes" onClick={() => openSchemeSearch(item.id)} />
        </span>
      ),
    },
    {
      key: 'ritc', header: 'RITC Code',
      cell: (item) => (
        <span className="tw:flex tw:w-[170px] tw:items-center tw:gap-0.5">
          <Input data-allow-text="" value={item.ritc || ''} onChange={(event) => updateItem(item.id, 'ritc', event.target.value)} />
          <SearchButton title="Search RITC" onClick={() => openRitcSearch(item.id)} />
          <Button size="sm" variant="default" title="Compulsory Compliance Requirements" onClick={() => showCcr(item)}>CCRs</Button>
        </span>
      ),
    },
    {
      key: 'desc', header: 'Description',
      cell: (item) => (
        <Input data-allow-text="" className="tw:w-[200px]" maxLength={120} title="Max 120 characters (Maps to DescOfGoods 1, 2, 3 in Schema)"
          value={item.desc || ''} onChange={(event) => updateItem(item.id, 'desc', event.target.value)} />
      ),
    },
    { key: 'qty', header: 'Qty', cell: (item) => <NumberInput className="tw:w-[60px]" value={item.qty ?? ''} onValueChange={(qty) => updateItem(item.id, 'qty', qty)} /> },
    {
      key: 'uqc', header: 'UQC',
      cell: (item) => <Input data-allow-text="" className="tw:w-[50px]" value={item.uqc || item.unit || ''} onChange={(event) => updateItem(item.id, 'uqc', event.target.value.toUpperCase())} />,
    },
    { key: 'price', header: 'Unit Price', cell: (item) => <NumberInput className="tw:w-[80px]" value={item.price ?? item.rate ?? ''} onValueChange={(price) => updateItem(item.id, 'price', price)} /> },
    { key: 'total', header: 'Total Value', cell: (item) => <Input readOnly tabIndex={-1} className="tw:w-[90px]" value={item.totalFc || item.total || ''} /> },
    {
      key: 'pmv', header: 'PMV',
      cell: (item) => (
        <span className="tw:flex tw:items-center tw:gap-1">
          <SelectBox className="tw:w-[52px]" placeholder="%" options={PMV_TYPES} value={item.pmvType} onValueChange={(type) => updateItem(item.id, 'pmvType', type)} />
          <NumberInput className="tw:w-[60px]" value={item.pmv ?? ''} onValueChange={(pmv) => updateItem(item.id, 'pmv', pmv)} />
        </span>
      ),
    },
  ];
}

function InvoiceSummary({ invoice, invoiceItems }) {
  const itemsTotal = invoiceItems.reduce((sum, item) => sum + (parseFloat(item.totalFc || item.total) || 0), 0);
  const invoiceValue = parseFloat(invoice.value || invoice.invoiceValue) || 0;
  const rupeesPerUnit = perUnit(invoice.currency, invoice.exchRate || invoice.exchangeRate, invoice.unitInRs);
  const difference = invoiceValue ? +(invoiceValue - itemsTotal).toFixed(2) : 0;
  const figures = [
    ['Invoice No', invoice.no || invoice.invoiceNo || ''],
    ['Invoice Date', invoice.date || invoice.invoiceDate || ''],
    ['Invoice Value', invoiceValue ? `${invoice.currency || ''} ${invoiceValue.toFixed(2)}` : ''],
    ['Invoice Value (INR)', invoiceValue && rupeesPerUnit ? (invoiceValue * rupeesPerUnit).toFixed(2) : ''],
    ['Invoice FOB (INR)', invoice.invFobInr || ''],
    ['Items Total', `${invoice.currency || ''} ${itemsTotal.toFixed(2)}`],
  ];
  return (
    <div className="tw:mt-1.5 tw:flex tw:flex-wrap tw:items-center tw:gap-x-4 tw:gap-y-1 tw:rounded-sm tw:border tw:border-border tw:bg-accent/40 tw:px-2 tw:py-1 tw:text-entry">
      {figures.map(([label, value]) => (
        <span key={label} className="tw:flex tw:min-h-[22px] tw:items-baseline tw:gap-1.5">
          <span className="tw:text-[11px] tw:font-semibold tw:text-muted-foreground">{label}</span>
          <b className="tw:tabular-nums tw:text-foreground">{value || '-'}</b>
        </span>
      ))}
      {invoiceValue > 0 && Math.abs(difference) > 0.01 && (
        <span className="tw:font-bold tw:text-destructive" title="Items total must equal the invoice value">⚠ Difference {difference > 0 ? '+' : ''}{difference.toFixed(2)}</span>
      )}
      {invoiceValue > 0 && Math.abs(difference) <= 0.01 && <span className="tw:font-bold tw:text-success">✓ Items match the invoice value</span>}
    </div>
  );
}

// data-nodirty: a click in the list is not a change of the item form
export default function ItemListSection({ ctx }) {
  const {
    items, exportData, formData, selectedRowId, openItem, gridContainerRef, draggedRowIndex, dragOverRowIndex, setDragOverRowIndex,
    handleDragStart, handleDragEnd, importItemsFile, addNewItem,
  } = ctx;
  const invoiceSerial = parseInt(formData.invSr, 10) || 1;
  const invoice = (exportData?.invoices || [])[invoiceSerial - 1] || {};
  const invoiceItems = items.filter((item) => invoiceSerialOf(item) === invoiceSerial);
  const columns = itemColumns(ctx);

  const openOnRowClick = (event, item) => {
    if (!event.currentTarget.contains(event.target) || event.target.closest(CONTROL_SELECTOR)) return;
    openItem(item);
  };

  return (
    <div className="glass-panel tw:mb-0 tw:px-2.5 tw:py-2" data-nodirty="1">
      <div className="tw:mb-1.5 tw:flex tw:flex-col tw:gap-1.5 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <h3 className="section-header tw:m-0">
          Item Details (Invoice {invoiceSerial}: {invoice.no || invoice.invoiceNo || 'N/A'}){' '}
          <span className="tw:text-[11px] tw:font-medium tw:text-muted-foreground">{invoiceItems.length} of {items.length} item(s)</span>
        </h3>
        <div className="tw:flex tw:flex-wrap tw:gap-1.5">
          <FileButton variant="success" accept=".xlsx,.xls,.csv" onFiles={importItemsFile}><FileSpreadsheet /> Import Excel</FileButton>
          <Button variant="destructive" onClick={() => window.dispatchEvent(new Event('export-open-ai-pdf'))}><FileText /> Import PDF</Button>
          <Button onClick={addNewItem}><PlusCircle /> Add Item</Button>
        </div>
      </div>

      <div ref={gridContainerRef} className="tw:h-[170px] tw:overflow-auto tw:rounded-md tw:border tw:border-border">
        <Table containerClassName="tw:overflow-visible">
          <TableHeader sticky>
            <TableRow className="tw:hover:bg-transparent">
              {columns.map((column) => (
                <TableHead key={column.key} className={cn(column.align === 'center' && 'tw:text-center', column.headClassName)}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow
                key={item.id}
                draggable
                data-state={item.id === selectedRowId ? 'selected' : undefined}
                className={cn('tw:cursor-grab', dragOverRowIndex === index && draggedRowIndex !== index && 'tw:border-b-2 tw:border-b-primary')}
                onDragStart={(event) => handleDragStart(event, index)}
                onDragEnter={() => setDragOverRowIndex(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(event) => event.preventDefault()}
                onClick={(event) => openOnRowClick(event, item)}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} className={cn('tw:py-0.5', column.align === 'center' && 'tw:text-center')}>{column.cell(item, index)}</TableCell>
                ))}
              </TableRow>
            ))}
            {!items.length && (
              <TableRow className="tw:hover:bg-transparent">
                <TableCell colSpan={columns.length} className="tw:py-4 tw:text-center tw:text-muted-foreground">No items yet - fill the form below and click Save</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <InvoiceSummary invoice={invoice} invoiceItems={invoiceItems} />
    </div>
  );
}
