import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { ComboInput, FlagInput, Input, Label, NumberInput, Section } from '@/components/ui';

const FREIGHT_INCLUDED_TERMS = ['CIF', 'CF', 'C&F', 'CFR'];
const INSURANCE_INCLUDED_TERMS = ['CIF', 'CI'];

const rowCountOf = (savedRows) => {
  if (Array.isArray(savedRows)) return savedRows.length;
  if (typeof savedRows !== 'string') return 0;
  try {
    const parsed = JSON.parse(savedRows);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

const termsNote = (terms, freightIncluded, insuranceIncluded) => {
  if (!terms) return 'enter the Terms first';
  if (freightIncluded && insuranceIncluded) return `terms ${terms} include freight and insurance`;
  if (freightIncluded) return `terms ${terms} include freight`;
  if (insuranceIncluded) return `terms ${terms} include insurance`;
  return `terms ${terms}: freight and insurance are declared here`;
};

function ColumnHeading({ children, wideOnly }) {
  return <span className={cn('tw:text-center tw:text-[10px] tw:font-bold tw:tracking-wide tw:text-muted-foreground tw:uppercase', wideOnly && 'tw:hidden tw:lg:block')}>{children}</span>;
}

const WIDE_ONLY_CELL = <span className="tw:hidden tw:lg:block" />;

export default function ChargesSection({ ctx }) {
  const { masters, handleInvoiceFieldChange, invoiceFormData } = ctx;
  const form = invoiceFormData || {};
  const setField = (name) => (value) => handleInvoiceFieldChange({ target: { name, value } });
  const terms = String(form.terms || form.termsOfInvoice || '').trim().toUpperCase();
  const freightIncluded = FREIGHT_INCLUDED_TERMS.includes(terms);
  const insuranceIncluded = INSURANCE_INCLUDED_TERMS.includes(terms);
  const invoiceCurrency = String(form.currency || form.invoiceCurrency || '').toUpperCase();
  const includedTitle = `Terms ${terms} already include this charge`;
  const miscRowCount = rowCountOf(form.miscChargeRows);

  const numberBox = (name, included, placeholder, title) => (
    <NumberInput name={name} disabled={included} placeholder={included ? '-' : placeholder} title={included ? includedTitle : title}
      value={included ? '' : (form[name] ?? '')} onValueChange={setField(name)} />
  );
  const currencyBox = (name, included) => (
    <ComboInput name={name} upper maxLength={3} disabled={included} placeholder={included ? '-' : (invoiceCurrency || 'CUR')}
      title={included ? includedTitle : `Currency of the amount (blank = invoice currency ${invoiceCurrency})`}
      options={masters?.currencies || []} getValue={(currency) => currency.currencyCode} getLabel={(currency) => currency.currencyName}
      value={included ? '' : (form[name] ?? '')} onValueChange={setField(name)} />
  );
  const chargeRow = (label, amountField, rateField, currencyField, included, extra) => (
    <Fragment key={label}>
      <Label>{label}</Label>
      {numberBox(amountField, included, 'Amount', `${label} amount`)}
      {numberBox(rateField, included, '%', `${label} as % of the invoice value (amount OR rate)`)}
      {currencyBox(currencyField, included)}
      {extra
        ? <div className="tw:col-span-3 tw:col-start-2 tw:flex tw:min-w-0 tw:items-center tw:gap-1.5 tw:lg:col-span-1 tw:lg:col-start-auto">{extra}</div>
        : <div className="tw:hidden tw:lg:block" />}
    </Fragment>
  );

  return (
    <Section
      title="Freight, Insurance & Other Charges"
      actions={<span className="tw:text-[11px] tw:text-muted-foreground">amount OR rate per charge; {termsNote(terms, freightIncluded, insuranceIncluded)}</span>}
    >
      <div className="tw:grid tw:grid-cols-[minmax(0,96px)_minmax(0,1fr)_minmax(0,1fr)_64px] tw:items-center tw:gap-x-2 tw:gap-y-1 tw:lg:grid-cols-[130px_110px_70px_64px_1fr_130px_110px_70px_64px_1fr]">
        <span /><ColumnHeading>Amount</ColumnHeading><ColumnHeading>Rate %</ColumnHeading><ColumnHeading>Cur</ColumnHeading>{WIDE_ONLY_CELL}
        {WIDE_ONLY_CELL}<ColumnHeading wideOnly>Amount</ColumnHeading><ColumnHeading wideOnly>Rate %</ColumnHeading><ColumnHeading wideOnly>Cur</ColumnHeading>{WIDE_ONLY_CELL}
        {chargeRow('Freight', 'freightValue', 'freightRate', 'freightCurrency', freightIncluded,
          <><Label title="Y = actual freight amount declared, N = notional (rate / included)">Actual</Label>
            <FlagInput name="whetherFreightActual" disabled={freightIncluded} value={freightIncluded ? '' : (form.whetherFreightActual || '')} onValueChange={setField('whetherFreightActual')} /></>)}
        {chargeRow('Insurance', 'insuranceValue', 'insuranceRate', 'insuranceCurrency', insuranceIncluded)}
        {chargeRow('Misc. charges', 'miscCharges', 'miscChargesRate', 'miscCurrency', false,
          miscRowCount ? <span className="tw:text-[11px] tw:text-muted-foreground" title="The charge-wise rows (brokerage, packing, royalties ...) are in the Misc. Charges [Not Included] popup">{miscRowCount} charge row(s)</span> : null)}
        {chargeRow('Loading charges', 'loadingAmount', 'loadingRate', 'loadingCurrency', false)}
        {chargeRow('Agency commission', 'agencyCommAmount', 'agencyCommRate', 'agencyCommCurrency', false)}
        {chargeRow('Discount', 'discountAmount', 'discountRate', 'discountCurrency', false,
          <><Label>Nature</Label><Input name="natureOfDiscount" maxLength={35} placeholder="e.g. TRADE DISCOUNT" value={form.natureOfDiscount ?? ''} onChange={handleInvoiceFieldChange} /></>)}
        {chargeRow('HSS load', 'hssLoadAmount', 'hssLoadRate', 'hssCurrency', false,
          <><Label title="Landing charges % (ICEGATE landingRate); blank = the ICES default">Landing %</Label>
            <NumberInput name="landingRate" placeholder="default" className="tw:w-[90px]" value={form.landingRate ?? ''} onValueChange={setField('landingRate')} /></>)}
      </div>
    </Section>
  );
}
