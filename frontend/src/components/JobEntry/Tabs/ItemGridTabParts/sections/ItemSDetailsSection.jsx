import { useId, useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { Button, Field, Input, Section, SelectBox, Switch } from '@/components/ui';
import { cn } from '@/lib/utils';
import { refreshItemDutyBoxes } from '../helpers';
import PopupFlagField, { OpenPopupButton } from './PopupFlagField';
import { BcdExemptionsPanel, ItemHistoryPanel } from './ItemSuggestionPanels';

const FIRST_LABEL_WIDTH = '160px';
const SHIPMENT_MODE_TEXT = { A: '(Air Shipment)', L: '(Land Shipment)' };

// ICEGATE takes only S or P; a new item starts as S
const RATE_TYPE_OPTIONS = [{ value: 'S', label: 'S - Standard' }, { value: 'P', label: 'P - Preferential (FTA)' }];
const RATE_TYPE_HELP = 'S = standard rate, P = preferential (FTA / CEPA notification) rate - with P the BCD notification must be the trade-agreement one and a COO certificate goes in the item\'s supporting docs';

const TARIFF_CODES = [
  { name: 'ritc', label: 'RITC', required: true },
  { name: 'cth', label: 'CTH' },
  { name: 'ceth', label: 'CETH' },
];

const invoiceNumberOf = (invoice) => invoice.invNo || invoice.invoiceSerialNumber;
const toNumber = (value) => {
  const number = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
};

function TariffCodeField({ code, defaultValue, onBlur, onSearch }) {
  return (
    <Field label={code.label} required={code.required}>
      <Input name={code.name} defaultValue={defaultValue} placeholder={code.label} maxLength={8} required={code.required}
        className="tw:w-full tw:tracking-wide tw:md:w-[110px]" onBlur={onBlur} />
      <OpenPopupButton title={`Search ${code.label} in the Tariff master`} onClick={onSearch} />
    </Field>
  );
}

/** Ex-bond item: the warehouse figures kept with the item, "left" follows the Quantity box while typing. */
function WarehouseBalanceLine({ item, typedQty }) {
  if (item._whBalanceQty === undefined || item._whBalanceQty === null) return null;
  const balance = toNumber(item._whBalanceQty);
  const draft = toNumber(item._whDraftQty);
  const quantity = toNumber(typedQty === null ? (item.qty || item.quantity) : typedQty);
  const left = Math.round((balance - quantity) * 1e6) / 1e6;
  const leftClass = left < 0 ? 'tw:text-destructive' : left === 0 ? 'tw:text-success' : 'tw:text-warning';
  return (
    <div className="tw:my-0.5 tw:flex tw:w-full tw:md:ml-[168px] tw:md:w-fit tw:flex-wrap tw:items-center tw:gap-3.5 tw:rounded-sm tw:border tw:border-primary/25 tw:bg-primary/5 tw:px-2.5 tw:py-0.5 tw:text-entry tw:normal-case tw:text-head">
      <span>WH BE qty <b>{toNumber(item._whOriginalQty)}</b></span>
      <span>Cleared by earlier ex-bonds <b>{toNumber(item._whClearedQty)}</b></span>
      {draft > 0 && <span title="In other ex-bond jobs that are not filed yet - not deducted from the balance">In draft ex-bonds <b>{draft}</b></span>}
      <span>Balance <b>{balance}</b></span>
      <span className={cn('tw:font-bold', leftClass)}>{left < 0 ? `Over the balance by ${-left}` : `Left in warehouse after this BE ${left}`}</span>
    </div>
  );
}

export default function ItemSDetailsSection({ ctx }) {
  const {
    handleDutyCalculate, jobData, openIgstModal, openSvbModal, selectedItem, transportMode, items, selectedRowId, nextItemSr,
    openTariffSearch, autoDesc, setAutoDesc, setFormValue, invoices, autoTariff, askItemHistory,
    itemHistory, setItemHistory, applyItemHistory, bcdExemptions, setBcdExemptions, applyBcdExemption,
  } = ctx;
  const descriptionId = useId();
  const jobInvoices = jobData?.invoices || [];
  const invoiceOptions = [...new Set(jobInvoices.map(invoiceNumberOf).filter(Boolean).map(String))];

  // The Radix selects keep their value in state and write it into a hidden native select of the item form,
  // which SAVE / MODIFY read; the section re-mounts with the form for every item, so the state starts from the item.
  // A value that is not in the list must start blank: the hidden select would fall back to its first option.
  const [invoiceNo, setInvoiceNo] = useState(invoiceOptions.includes(String(selectedItem.invNo)) ? String(selectedItem.invNo) : '');
  const [rateType, setRateType] = useState(/^P/i.test(String(selectedItem.rateTypeFlag || '')) ? 'P' : 'S');
  const [typedQty, setTypedQty] = useState(null);

  const invoiceSrOf = (number) => {
    const index = jobInvoices.findIndex((invoice) => invoiceNumberOf(invoice) === number);
    return index >= 0 ? String(index + 1) : '1';
  };
  const itemInvoiceSr = selectedItem.invSrNo || invoiceSrOf(selectedItem.invNo);
  const defaultItemSr = selectedItem.itemSrNo || nextItemSr(items, itemInvoiceSr);
  // the selected item keeps its own Sr No in its own invoice; any other invoice gets its next free number
  const itemSrForInvoice = (number) => {
    const invoiceSr = invoiceSrOf(number);
    const ownInvoice = selectedItem.id === selectedRowId && String(itemInvoiceSr) === invoiceSr;
    return ownInvoice ? String(selectedItem.itemSrNo || '') : nextItemSr(items, invoiceSr);
  };
  const chooseInvoice = (number) => {
    setInvoiceNo(number);
    setFormValue('itemSrNo', itemSrForInvoice(number));
  };

  // Total Amount = quantity x unit price, read through the item form only (the popups have boxes of the same names);
  // the duty boxes follow because a specific rate is multiplied by the quantity
  const recalculateTotal = () => {
    const form = document.getElementById('item-form');
    if (!form) return;
    const amountOf = (name) => parseFloat(String(form.elements.namedItem(name)?.value).replace(/,/g, '')) || 0;
    const total = form.elements.namedItem('value');
    if (total) total.value = (amountOf('qty') * amountOf('price')).toFixed(2);
    refreshItemDutyBoxes(selectedItem, invoices, jobData);
  };

  const title = `Item's Details ${SHIPMENT_MODE_TEXT[transportMode] || '(Sea Shipment)'}`;

  return (
    <>
      <ItemHistoryPanel history={itemHistory} onUse={applyItemHistory} onHide={() => setItemHistory(null)} />
      <BcdExemptionsPanel exemptions={bcdExemptions} onUse={applyBcdExemption} onHide={() => setBcdExemptions(null)} />

      <Section title={title}>
        <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:flex-wrap tw:md:items-center tw:md:gap-5">
          <Field label="Inv No." required labelWidth={FIRST_LABEL_WIDTH}>
            <SelectBox name="invNo" required clearable clearLabel="--Select--" placeholder="--Select--" className="tw:w-full tw:md:w-[140px]"
              options={invoiceOptions} value={invoiceNo} onValueChange={chooseInvoice} />
          </Field>
          <Field label="Item Sr. No." required>
            <Input name="itemSrNo" required defaultValue={defaultItemSr} className="tw:w-full tw:text-center tw:md:w-14"
              title="Serial of the item within its invoice - the next free number for a new item" />
          </Field>
          <Field label="Rate Type" required hint={RATE_TYPE_HELP}>
            <SelectBox name="rateTypeFlag" required className="tw:w-full tw:md:w-[150px]" options={RATE_TYPE_OPTIONS} value={rateType} onValueChange={setRateType} />
          </Field>
          <Field label="Product Code" className="tw:md:ml-auto">
            <Input name="productCode" defaultValue={selectedItem.productCode || ''} className="tw:w-full tw:md:w-[140px]" />
          </Field>
        </div>

        <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:flex-wrap tw:md:items-center tw:md:gap-3">
          <span className="tw:shrink-0 tw:text-entry tw:md:w-[160px]">Tariff (HS)</span>
          {TARIFF_CODES.map((code) => (
            <TariffCodeField key={code.name} code={code}
              defaultValue={selectedItem[code.name] || (code.name === 'ritc' ? selectedItem.hsCode : '') || ''}
              onBlur={code.name === 'ritc' ? (event) => autoTariff(event.target.value) : undefined}
              onSearch={() => openTariffSearch(code.name)} />
          ))}
          <Button variant="default" className="tw:self-start tw:md:ml-4 tw:md:self-auto" onClick={handleDutyCalculate}><CheckSquare /> Customs Duty Calculator</Button>
          <span className="tw:min-w-0 tw:truncate tw:md:ml-auto tw:text-[10px] tw:text-muted-foreground"
            title="Picking a RITC from the Tariff master also fills CTH / CETH, UQC and the description">ⓘ = Tariff master search</span>
        </div>

        <Field label="Item Description" required labelWidth={FIRST_LABEL_WIDTH} htmlFor={descriptionId}>
          {/* on = the tariff text of a picked RITC replaces the description; off = it only fills an empty box */}
          <Switch id={`${descriptionId}-auto`} checked={Boolean(autoDesc)} onClick={() => setAutoDesc(!autoDesc)}
            title={autoDesc ? 'Auto: the picked RITC\'s tariff description replaces this box (click to switch off)' : 'Manual: a picked RITC fills this box only when it is empty (click to switch on)'} />
          <span className="tw:text-[10px] tw:whitespace-nowrap tw:text-muted-foreground">{autoDesc ? 'from tariff' : 'manual'}</span>
          <Input id={descriptionId} name="desc" required defaultValue={selectedItem.desc || selectedItem.productDescription || ''}
            className="tw:flex-1" onBlur={() => askItemHistory(false)} />
        </Field>

        <Field label="Desc Only in Checklist" labelWidth={FIRST_LABEL_WIDTH} note="[This Desc display only in checklist not in Customs Flatfile.]">
          <Input name="descOnlyInChecklist" defaultValue={selectedItem.descOnlyInChecklist || ''} className="tw:text-muted-foreground" />
        </Field>

        <WarehouseBalanceLine item={selectedItem} typedQty={typedQty} />

        <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:flex-wrap tw:md:items-center tw:md:gap-4">
          <Field label="Quantity" required labelWidth={FIRST_LABEL_WIDTH}>
            <Input name="qty" required defaultValue={selectedItem.qty || selectedItem.quantity || ''} className="tw:w-full tw:md:w-[120px]"
              onChange={(event) => { recalculateTotal(); setTypedQty(event.target.value); }} />
          </Field>
          <Field label="Unit" required>
            <Input name="uqc" list="uqc-list" required defaultValue={selectedItem.uqc || selectedItem.unit || ''} className="tw:w-full tw:uppercase tw:md:w-20"
              title="Unit of measure - mandatory on every BE item" />
          </Field>
          <Field label="Unit Price" required>
            <Input name="price" required defaultValue={selectedItem.price || selectedItem.unitPrice || ''} className="tw:w-full tw:md:w-[120px]" onChange={recalculateTotal} />
          </Field>
          <Field label="Total Amount" required>
            <Input name="value" required defaultValue={selectedItem.value || selectedItem.assessableValue || ''} className="tw:w-full tw:md:w-[120px]" />
          </Field>
          <PopupFlagField label="IGST Duty" required name="igstDutyFlag" defaultValue={selectedItem.igstDutyFlag || ''} onOpen={openIgstModal} />
          <PopupFlagField label="SVB" note="[Item Wise]" name="svbFlag" defaultValue={selectedItem.svbFlag || ''} onOpen={openSvbModal} />
        </div>
      </Section>
    </>
  );
}
