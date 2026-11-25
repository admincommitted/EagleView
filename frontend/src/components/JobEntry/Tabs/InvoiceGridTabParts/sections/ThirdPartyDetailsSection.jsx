import { ArrowUpDown, CheckSquare, Copy, Pencil, RefreshCw, Settings2, Trash2, X } from 'lucide-react';
import { Button, ComboInput, Field, FlagInput, Input, NumberInput, Section } from '@/components/ui';

export default function ThirdPartyDetailsSection({ ctx }) {
  const { masters, handleArrangeSerial, handleClear, handleDelete, handleDeleteMultiple, handleDuplicateInvoice, handleInvoiceFieldChange, handleModify, handleSave, invoiceFormData, setInvoiceFormData, showAdditionalDetails, showAeoDetails, showThirdPartyDetails } = ctx;
  const form = invoiceFormData || {};
  const setField = (name) => (value) => handleInvoiceFieldChange({ target: { name, value } });
  const text = (name, props = {}) => <Input name={name} value={form[name] || ''} onChange={handleInvoiceFieldChange} {...props} />;
  const country = (name) => (
    <ComboInput name={name} upper placeholder="Country" options={masters?.countries || []} getValue={(option) => option.code} getLabel={(option) => option.name}
      value={form[name] || ''} onValueChange={setField(name)} />
  );
  const toggleOther = () => setInvoiceFormData((previous) => ({ ...previous, additionalDetailsFlag: showAdditionalDetails ? '' : 'Y' }));
  const docBox = (title, noKey, dateKey) => (
    <Section title={title} className="tw:flex-1 tw:rounded-sm tw:border tw:border-border tw:p-2">
      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center">
        <Field label="No" className="tw:flex-1">{text(noKey, { placeholder: 'No' })}</Field>
        <Field label="Date" className="tw:flex-1">{text(dateKey, { placeholder: 'Date' })}</Field>
      </div>
    </Section>
  );

  return (
    <>
      {(showThirdPartyDetails || showAeoDetails || showAdditionalDetails) && (
        <div className="tw:mt-2 tw:flex tw:flex-col tw:gap-3 tw:rounded-sm tw:border tw:border-border tw:bg-background tw:p-3">
          {showThirdPartyDetails && (
            <Section title="Third Party Details">
              <div className="tw:grid tw:grid-cols-1 tw:gap-x-4 tw:gap-y-1.5 tw:sm:grid-cols-2">
                <Field label="Name" labelWidth="80px">{text('thirdPartyName', { placeholder: 'Name' })}</Field>
                <Field label="Address1" labelWidth="80px">{text('thirdPartyAddress1')}</Field>
              </div>
              <div className="tw:grid tw:grid-cols-1 tw:gap-x-4 tw:gap-y-1.5 tw:sm:grid-cols-2 tw:lg:grid-cols-3">
                <Field label="Address2" labelWidth="80px">{text('thirdPartyAddress2', { placeholder: 'Address2' })}</Field>
                <Field label="City" labelWidth="80px">{text('thirdPartyCity', { placeholder: 'City' })}</Field>
                <Field label="Sub-Division" labelWidth="80px">{text('thirdPartyCntrySubDvsn', { placeholder: 'Sub-division' })}</Field>
                <Field label="Pin" labelWidth="80px">{text('thirdPartyPin', { placeholder: 'Pin' })}</Field>
                <Field label="Country" labelWidth="80px">{country('thirdPartyCountryCode')}</Field>
                <Field label="Terms Place" labelWidth="80px">{text('termsPlace', { placeholder: 'Terms place' })}</Field>
              </div>
            </Section>
          )}

          {showAeoDetails && (
            <Section title="AEO Details">
              <div className="tw:grid tw:grid-cols-1 tw:gap-x-4 tw:gap-y-1.5 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:lg:gap-y-0">
                <Field label="AEO Code" labelWidth="80px">{text('authorizedEconomicOperatorCode', { placeholder: 'AEO code' })}</Field>
                <Field label="AEO Country" labelWidth="80px">{country('authorizedEconomicOperatorCountry')}</Field>
                <Field label="AEO Role" labelWidth="80px">{text('authorizedEconomicOperatorRole', { placeholder: 'AEO role' })}</Field>
              </div>
            </Section>
          )}

          {showAdditionalDetails && (
            <Section title="Additional Details">
              <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-4 tw:gap-y-1.5">
                <Field label="Revenue (%)"><NumberInput name="revenuePercent" className="tw:w-20" value={form.revenuePercent || ''} onValueChange={setField('revenuePercent')} /></Field>
                <Field label="Revenue Deposit On [Ass. Val/Duty/Both]" hint="A = assessable value, D = duty, B = both">
                  <FlagInput allowed="ADB" name="revenueDepositOn" value={form.revenueDepositOn || ''} onValueChange={setField('revenueDepositOn')} />
                </Field>
                <Field label="Description" className="tw:min-w-56 tw:flex-1">{text('additionalDescription', { placeholder: 'Description' })}</Field>
                <Field label="Relationship [B/W Buyer & Seller]">{text('buyerSellerRelationship', { className: 'tw:w-12 tw:text-center' })}</Field>
                <Field label="Hand Carriage [Y/N]">
                  <FlagInput name="handCarriage" value={form.handCarriage || ''} onValueChange={setField('handCarriage')} />
                </Field>
              </div>
              <div className="tw:flex tw:flex-col tw:gap-3 tw:lg:flex-row">
                {docBox('Purchase Order Details', 'purchaseOrderNumber', 'purchaseOrderDate')}
                {docBox('Contract Details', 'contractNumber', 'contractDate')}
                {docBox('Letter Of Credit Details', 'lcNumber', 'lcDate')}
              </div>
            </Section>
          )}
        </div>
      )}

      <div className="tw:mt-auto tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-1.5 tw:border-t tw:border-border tw:pt-3 tw:pb-1">
        <Button variant="success" onClick={handleSave} title="Add this invoice to the job"><CheckSquare /> Save</Button>
        <Button variant="success" onClick={handleModify} title="Put the changes into the selected invoice"><Pencil /> Modify</Button>
        <Button variant="destructive" onClick={handleDelete}><X /> Delete</Button>
        <Button variant="destructive" onClick={handleDeleteMultiple} title="Delete the invoices ticked in the grid"><Trash2 /> Delete Multiple Invoice</Button>
        <Button variant="default" onClick={handleClear} title="Empty the form for a new invoice"><RefreshCw /> Clear</Button>
        <Button onClick={handleDuplicateInvoice}><Copy /> Duplicate Invoice</Button>
        <Button variant="success" onClick={handleArrangeSerial}><ArrowUpDown /> Arrange Invoice Serial No</Button>
        <Button variant={showAdditionalDetails ? 'secondary' : 'success'} onClick={toggleOther} title="Revenue deposit, description, PO / contract / LC, hand carriage"><Settings2 /> Other Details</Button>
      </div>
    </>
  );
}
