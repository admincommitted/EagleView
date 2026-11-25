import { useMemo } from 'react';
import { DateInput, Field, FlagInput, Input, Modal, NumberInput, SearchSelect, Textarea } from '@/components/ui';

const CONDITION_LINES = [1, 2, 3, 4, 5];
const ADDRESS_LINES = [1, 2, 3];

function AddressFields({ prefix, countryKey, form, onChange, onCountryChange, countryOptions }) {
  const valueOf = (key) => form[`${prefix}${key}`] ?? '';
  return (
    <>
      <Field label="Name" labelWidth="90px">
        <Input name={`${prefix}Name`} value={valueOf('Name')} onChange={onChange} placeholder="Name" />
      </Field>
      {ADDRESS_LINES.map((line) => (
        <Field key={line} label={`Address${line}`} labelWidth="90px">
          <Input name={`${prefix}Address${line}`} value={valueOf(`Address${line}`)} onChange={onChange} placeholder={`Address${line}`} />
        </Field>
      ))}
      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:gap-3">
        <Field label="Country" labelWidth="90px" className="tw:flex-1">
          <SearchSelect options={countryOptions} value={form[countryKey] ?? ''} onValueChange={onCountryChange} placeholder="Country" allowCustom />
        </Field>
        <Field label="Pin" className="tw:md:w-36">
          <Input name={`${prefix}Pin`} value={valueOf('Pin')} onChange={onChange} />
        </Field>
      </div>
    </>
  );
}

export default function SvbLoadingInvoiceSection({ ctx }) {
  const {
    handleInvoiceFieldChange, masters, invoiceFormData: form, setInvoiceFormData,
    isSvbModalOpen, setIsSvbModalOpen, isOtherInfoModalOpen, setIsOtherInfoModalOpen,
    isConditionsModalOpen, setIsConditionsModalOpen, isSellerModalOpen, setIsSellerModalOpen,
    isBrokerModalOpen, setIsBrokerModalOpen,
  } = ctx;

  const setField = (key) => (value) => setInvoiceFormData((previous) => ({ ...previous, [key]: value }));
  const countryOptions = useMemo(
    () => (masters?.countries || []).map((country) => ({ value: country.code, label: `${country.code} - ${country.name}` })),
    [masters?.countries]
  );

  const confirmSvb = () => {
    setInvoiceFormData((previous) => ({ ...previous, svbLoadingFlag: previous.svbReferenceNumber ? 'Y' : previous.svbLoadingFlag }));
    setIsSvbModalOpen(false);
  };

  const closeOnly = (setOpen) => ({ onClose: () => setOpen(false), onOk: () => setOpen(false), closeOnOutside: false });

  return (
    <>
      <Modal open={isSvbModalOpen} title="SVB Loading Invoice" width={650} onClose={() => setIsSvbModalOpen(false)} onOk={confirmSvb} closeOnOutside={false}>
        <div className="tw:grid tw:grid-cols-1 tw:gap-x-4 tw:gap-y-2.5 tw:sm:grid-cols-2">
          <Field label="Ref No." required labelWidth="70px">
            <Input required value={form.svbReferenceNumber || ''} onChange={(event) => setField('svbReferenceNumber')(event.target.value)} />
          </Field>
          <Field label="Custom House" required labelWidth="96px">
            <Input required maxLength={6} placeholder="e.g. INDEL4" value={form.customHouseCodeWhichHasImposedLoad || ''}
              onChange={(event) => setField('customHouseCodeWhichHasImposedLoad')(event.target.value.toUpperCase())} />
          </Field>
          <Field label="Date" required labelWidth="70px">
            <DateInput required value={form.svbReferenceDate || ''} onValueChange={setField('svbReferenceDate')} />
          </Field>
          <span className="tw:hidden tw:sm:block" />
          <Field label="SVB load on ass. value / duty / both [A/D/B]" required className="tw:col-span-full" hint="A = on the assessable value, D = on the duty, B = on both">
            <FlagInput allowed="ADB" required value={form.svbFlag || ''} onValueChange={setField('svbFlag')} />
          </Field>
        </div>

        <span className="tw:mt-1.5 tw:text-entry tw:font-semibold tw:text-head">SVB load on</span>
        <div className="tw:grid tw:grid-cols-1 tw:gap-x-4 tw:gap-y-2.5 tw:sm:grid-cols-2">
          <Field label="Ass. Value (%)" labelWidth="96px">
            <NumberInput value={form.svbLoadAssessableValue || ''} onValueChange={setField('svbLoadAssessableValue')} />
          </Field>
          <Field label="SVB Load Status [F/P]" hint="F = final, P = provisional">
            <FlagInput allowed="FP" value={form.whetherloadProvisionalOnAssValue || ''} onValueChange={setField('whetherloadProvisionalOnAssValue')} />
          </Field>
          <Field label="Duty (%)" labelWidth="96px">
            <NumberInput value={form.svbLoadOnDuty || ''} onValueChange={setField('svbLoadOnDuty')} />
          </Field>
          <Field label="SVB Load Status [F/P]" hint="F = final, P = provisional">
            <FlagInput allowed="FP" value={form.whetherProvisionalOnDuty || ''} onValueChange={setField('whetherProvisionalOnDuty')} />
          </Field>
        </div>
      </Modal>

      <Modal open={isOtherInfoModalOpen} title="Other Relevant Information" width={500} {...closeOnly(setIsOtherInfoModalOpen)}>
        <Textarea name="otherRelevantInform" value={form.otherRelevantInform ?? ''} onChange={handleInvoiceFieldChange} className="tw:h-[150px] tw:resize-none" />
      </Modal>

      <Modal open={isConditionsModalOpen} title="Conditions of Restrictions Attached with Sale" width={600} {...closeOnly(setIsConditionsModalOpen)}>
        {CONDITION_LINES.map((line) => (
          <Field key={line} label={`${line}. Condition`} labelWidth="80px">
            <Input name={`conditionsAttachedWithSale${line}`} value={form[`conditionsAttachedWithSale${line}`] ?? ''} onChange={handleInvoiceFieldChange} />
          </Field>
        ))}
      </Modal>

      <Modal open={isSellerModalOpen} title="Seller Details" width={600} {...closeOnly(setIsSellerModalOpen)}>
        <AddressFields prefix="seller" countryKey="sellerCountryName" form={form} onChange={handleInvoiceFieldChange}
          onCountryChange={setField('sellerCountryName')} countryOptions={countryOptions} />
      </Modal>

      <Modal open={isBrokerModalOpen} title="Broker's Details" width={600} {...closeOnly(setIsBrokerModalOpen)}>
        <AddressFields prefix="broker" countryKey="brokerCountry" form={form} onChange={handleInvoiceFieldChange}
          onCountryChange={setField('brokerCountry')} countryOptions={countryOptions} />
      </Modal>
    </>
  );
}
