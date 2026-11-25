import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Button, ComboInput, DataTable, NumberInput } from '@/components/ui';
import { purchaseApi } from './purchaseApi';
import { TotalsBar } from './POItemsTable';
import { blankItem, itemsTotals, lineAmounts, rupees, ukDate } from './purchaseFormat';

const MIN_SEARCH_LENGTH = 2;
const serverFiltered = () => true;

function SuggestionOption({ suggestion }) {
  return (
    <span className="tw:flex tw:min-w-0 tw:flex-col">
      <b className="tw:text-foreground">{suggestion.itemName}</b>
      <span className="tw:text-[11px] tw:text-muted-foreground">
        Last: ₹{suggestion.unitPrice} | GST: {suggestion.gstRate}% | {ukDate(suggestion.lastPurchased)} ({suggestion.poNumber})
      </span>
    </span>
  );
}

function AmountBox({ value, strong }) {
  return (
    <span className={strong ? 'tw:block tw:min-w-20 tw:font-bold tw:text-primary' : 'tw:block tw:min-w-20 tw:font-semibold'}>{rupees(value)}</span>
  );
}

/** The editable item lines of a new PO; a typed item name offers the earlier purchases of that item. */
export default function POItemsEditor({ items, onItemsChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [activeRow, setActiveRow] = useState(null);

  const searchHistory = async (query) => {
    if (!query || query.length < MIN_SEARCH_LENGTH) { setSuggestions([]); return; }
    try {
      setSuggestions(await purchaseApi.itemHistory(query));
    } catch (error) {
      console.error(errorMessage(error));
    }
  };

  const updateItem = (index, changes) => onItemsChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)));
  const typeItemName = (index, itemName) => { updateItem(index, { itemName }); setActiveRow(index); searchHistory(itemName); };
  const applySuggestion = (index, suggestion) => {
    updateItem(index, { itemName: suggestion.itemName, unitPrice: suggestion.unitPrice, gstRate: suggestion.gstRate });
    setSuggestions([]);
    setActiveRow(null);
  };
  const numberCell = (key, placeholder) => (item, index) => (
    <NumberInput required className="tw:min-w-16" placeholder={placeholder} value={item[key]} onValueChange={(value) => updateItem(index, { [key]: value })} />
  );

  const columns = [
    { key: 'srNo', header: 'Sr. No.', align: 'center', width: 50, className: 'tw:font-bold tw:text-muted-foreground', cell: (item, index) => index + 1 },
    {
      key: 'itemName', header: 'Item Name', className: 'tw:min-w-[220px]',
      cell: (item, index) => (
        <ComboInput
          required
          placeholder="Item..."
          value={item.itemName}
          options={activeRow === index ? suggestions : []}
          filter={serverFiltered}
          getValue={(suggestion) => suggestion.itemName}
          renderOption={(suggestion) => <SuggestionOption suggestion={suggestion} />}
          onValueChange={(text) => typeItemName(index, text)}
          onSelect={(suggestion) => applySuggestion(index, suggestion)}
          onFocus={() => { setActiveRow(index); searchHistory(item.itemName); }}
        />
      ),
    },
    { key: 'quantity', header: 'Quantity', width: 90, cell: numberCell('quantity') },
    { key: 'unitPrice', header: 'Unit Price (₹)', width: 110, cell: numberCell('unitPrice') },
    { key: 'gstRate', header: 'GST Rate (%)', width: 90, cell: numberCell('gstRate', '%') },
    { key: 'gst', header: 'GST Amt', align: 'right', cell: (item) => <AmountBox value={lineAmounts(item).gst} /> },
    { key: 'total', header: 'Total', align: 'right', cell: (item) => <AmountBox value={lineAmounts(item).total} strong /> },
    {
      key: 'remove', header: '', align: 'center', width: 36,
      cell: (item, index) => (
        <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Remove this item" aria-label="Remove this item"
          onClick={() => onItemsChange(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></Button>
      ),
    },
  ];

  const totals = itemsTotals(items);

  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      <div>
        <DataTable columns={columns} rows={items} rowKey={(item, index) => index} stickyHeader={false} emptyText="No items - add one below" className="tw:text-entry" />
        <TotalsBar totals={[{ label: 'GST:', value: rupees(totals.gst) }, { label: 'Grand Total:', value: rupees(totals.total) }]} />
      </div>
      <div>
        <Button variant="secondary" onClick={() => onItemsChange([...items, blankItem()])}><Plus /> Add Another Item</Button>
      </div>
    </div>
  );
}
