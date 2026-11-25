import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DateInput, Field, Input, Section, SelectBox } from '@/components/ui';
import FieldAutocomplete from '@/components/FieldAutocomplete';
import { LinkButton, RequiredBox } from '../awbFormParts';

const CHARGE_CODES = [
  { value: 'PP', label: 'PP - All prepaid (cash)' },
  { value: 'PX', label: 'PX - All prepaid (credit / CASS)' },
  { value: 'CC', label: 'CC - All collect' },
  { value: 'CP', label: 'CP - Destination collect (cash)' },
  { value: 'CX', label: 'CX - Destination collect (credit)' },
  { value: 'CG', label: 'CG - All collect (GBL)' },
];
const PREPAID_COLLECT = [{ value: 'P', label: 'P - Prepaid' }, { value: 'C', label: 'C - Collect' }];
const STANDARD_ACCOUNTING_TEXT = /^(FREIGHT (PREPAID|COLLECT))?$/;
const INSURANCE_HINT = 'If the carrier offers insurance and it is asked for as per its conditions, put the amount to be insured in figures here.';

const isFilled = (...values) => values.some((value) => String(value ?? '').trim() !== '');

function AirportBox({ label, required, value, onChange, onSelect, listType = 'airport', placeholder = 'airport', maxLength }) {
  return (
    <RequiredBox required={required}>
      <Field label={label} required={required} layout="col" className="tw:w-full">
        <FieldAutocomplete listType={listType} value={value} onChange={(event) => onChange(event.target.value.toUpperCase())}
          onSelect={onSelect || ((option) => onChange(option.title))} placeholder={placeholder} maxLength={maxLength} />
      </Field>
    </RequiredBox>
  );
}

function CarrierBox(props) {
  return <AirportBox listType="airline-code" placeholder="airline" maxLength={2} {...props} />;
}

/**
 * Flights and the charge declarations.
 * thirdFlightDetails: the 3rd flight line also has its flight number and date (e-AWB).
 * showCto: the CTO box after the departure time (HAWB / MAWB). upperCase: typed values are kept in capitals (MAWB).
 * declaredValuesRequiredWhenEmpty: the declared values show the "must fill" line only while empty (MAWB).
 */
export default function RoutingSection({
  ctx, flightTimeLabel = 'Flt Time', showCto = false, thirdFlightDetails = false, upperCase = false,
  declaredValuesRequiredWhenEmpty = false, onDestAirportPick,
}) {
  const {
    accountingInfo, by1, by2, by3, carriageValue, chargeCode, currencyCode, customsValue, depAirport, destAirport, flight3,
    flightDate1, flightDate2, flightDate3, flightNumber1, flightNumber2, flightTime1, flightTime2, insuranceValue, otherPC,
    setAccountingInfo, setBy1, setBy2, setBy3, setCarriageValue, setChargeCode, setCurrencyCode, setCustomsValue, setDepAirport,
    setDestAirport, setDestAirportName, setFlight3, setFlightDate1, setFlightDate2, setFlightDate3, setFlightNumber1,
    setFlightNumber2, setFlightTime1, setFlightTime2, setInsuranceValue, setOtherCharges, setOtherPC, setTo1, setTo2, setTo3,
    setWtValPC, to1, to2, to3, wtValPC,
  } = ctx;
  const [secondOpen, setSecondOpen] = useState(false);
  const [thirdOpen, setThirdOpen] = useState(false);
  const showSecond = secondOpen || isFilled(to2, by2, flightNumber2, flightDate2, flightTime2);
  const showThird = thirdOpen || (thirdFlightDetails ? isFilled(to3, by3, flight3, flightDate3) : isFilled(to3, by3));
  const typed = (value) => (upperCase ? value.toUpperCase() : value);
  const declaredRequired = (value) => (declaredValuesRequiredWhenEmpty ? !value : true);
  const flightGrid = cn('tw:grid tw:grid-cols-2 tw:gap-2 tw:sm:grid-cols-4', showCto ? 'tw:lg:grid-cols-8' : 'tw:lg:grid-cols-7');

  const pickDestination = (option) => {
    setDestAirport(option.title);
    if (onDestAirportPick) onDestAirportPick(option);
    else setDestAirportName(option.subtitle || '');
  };
  const setOtherChargesPrepaidCollect = (prepaidOrCollect) => {
    setOtherCharges((charges) => charges.map((charge) => ({ ...charge, ppcc: prepaidOrCollect === 'C' ? 'CC' : 'PP' })));
  };
  const changeChargeCode = (code) => {
    setChargeCode(code);
    const prepaidOrCollect = code.charAt(0) === 'P' ? 'P' : 'C'; // PX (prepaid on credit) is prepaid too
    if (STANDARD_ACCOUNTING_TEXT.test(String(accountingInfo || '').trim())) setAccountingInfo(prepaidOrCollect === 'P' ? 'FREIGHT PREPAID' : 'FREIGHT COLLECT');
    setWtValPC(prepaidOrCollect);
    setOtherPC(prepaidOrCollect);
    setOtherChargesPrepaidCollect(prepaidOrCollect);
  };
  const removeSecond = () => { setTo2(''); setBy2(''); setFlightNumber2(''); setFlightDate2(''); setFlightTime2(''); setSecondOpen(false); };
  const removeThird = () => {
    setTo3(''); setBy3('');
    if (thirdFlightDetails) { setFlight3(''); setFlightDate3(''); }
    setThirdOpen(false);
  };
  const flightNumberBox = (label, value, setValue) => (
    <Field label={label} layout="col">
      <Input autoComplete="off" maxLength={7} placeholder="e.g. BA123" value={value} onChange={(event) => setValue(typed(event.target.value))} />
    </Field>
  );
  const dateBox = (label, value, setValue) => (
    <Field label={label} layout="col"><DateInput value={value} onValueChange={setValue} /></Field>
  );
  const timeBox = (label, value, setValue) => (
    <Field label={label} layout="col"><Input type="time" autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} /></Field>
  );
  const removeLink = (label, title, onClick) => (
    <div className="tw:flex tw:items-end tw:pb-1"><LinkButton tabIndex={-1} title={title} onClick={onClick}>{label}</LinkButton></div>
  );

  return (
    <Section title="Flight Bookings / Routing and Charge Declarations" className="tw:px-2 tw:pt-1">
      <div className={flightGrid}>
        <AirportBox label="Airport of Departure" required value={depAirport} onChange={setDepAirport} />
        <AirportBox label="Airport of Destination" required value={destAirport} onChange={setDestAirport} onSelect={pickDestination} />
        <AirportBox label="To" required value={to1} onChange={setTo1} />
        <CarrierBox label="By First Carrier" required value={by1} onChange={setBy1} />
        {flightNumberBox('Flt No 1', flightNumber1, setFlightNumber1)}
        {dateBox('Flt Dt 1', flightDate1, setFlightDate1)}
        {timeBox(`${flightTimeLabel} 1`, flightTime1, setFlightTime1)}
        {showCto && <Field label="CTO" layout="col"><SelectBox options={[]} placeholder="Select" /></Field>}
      </div>

      {showSecond && (
        <div className={flightGrid}>
          <AirportBox label="To" value={to2} onChange={setTo2} />
          <CarrierBox label="By" value={by2} onChange={setBy2} />
          {flightNumberBox('Flt No 2', flightNumber2, setFlightNumber2)}
          {dateBox('Flt Dt 2', flightDate2, setFlightDate2)}
          {timeBox(`${flightTimeLabel} 2`, flightTime2, setFlightTime2)}
          {removeLink('Remove flight 2', 'Clears flight 2 and hides this line', removeSecond)}
        </div>
      )}

      {showThird && (
        <div className={flightGrid}>
          <AirportBox label="To" value={to3} onChange={setTo3} />
          <CarrierBox label="By" value={by3} onChange={setBy3} />
          {thirdFlightDetails && (
            <>
              <Field label="Flt 3" layout="col">
                <Input autoComplete="off" maxLength={7} placeholder="e.g. AI101" value={flight3} onChange={(event) => setFlight3(event.target.value.toUpperCase())} />
              </Field>
              {dateBox('Flt Dt 3', flightDate3, setFlightDate3)}
            </>
          )}
          {removeLink('Remove flight 3', 'Clears flight 3 and hides this line', removeThird)}
        </div>
      )}

      {(!showSecond || !showThird) && (
        <div className="tw:flex tw:gap-3.5">
          {!showSecond && <LinkButton onClick={() => setSecondOpen(true)}>+ Add flight 2</LinkButton>}
          {showSecond && !showThird && <LinkButton onClick={() => setThirdOpen(true)}>+ Add flight 3</LinkButton>}
        </div>
      )}

      <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:py-1 tw:sm:grid-cols-4 tw:lg:grid-cols-[80px_100px_100px_100px_1.5fr_1.5fr_1fr]">
        <Field label="Currency" layout="col">
          <FieldAutocomplete listType="currency" maxLength={3} value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} />
        </Field>
        <Field label="CHGS CODE" layout="col">
          <SelectBox options={CHARGE_CODES} value={chargeCode} onValueChange={changeChargeCode} className="tw:font-bold tw:text-primary" />
        </Field>
        <Field label="Wt/Val(P/C)" layout="col">
          <SelectBox options={PREPAID_COLLECT} value={wtValPC} onValueChange={setWtValPC} className="tw:font-bold tw:text-primary" />
        </Field>
        <Field label="Other(P/C)" layout="col">
          <SelectBox options={PREPAID_COLLECT} value={otherPC} className="tw:font-bold tw:text-primary"
            onValueChange={(prepaidOrCollect) => { setOtherPC(prepaidOrCollect); setOtherChargesPrepaidCollect(prepaidOrCollect); }} />
        </Field>
        <Field label="Declared Value for Carriage" layout="col">
          <Input name="carriageValue" autoComplete="off" maxLength={12} value={carriageValue} required={declaredRequired(carriageValue)} className="tw:font-bold"
            onChange={(event) => setCarriageValue(typed(event.target.value))} />
        </Field>
        <Field label="Declared Value for Customs" layout="col">
          <Input name="customsValue" autoComplete="off" maxLength={12} value={customsValue} required={declaredRequired(customsValue)} className="tw:font-bold"
            onChange={(event) => setCustomsValue(typed(event.target.value))} />
        </Field>
        <Field label="Amount of Insurance" hint={INSURANCE_HINT} layout="col">
          <Input name="insuranceValue" title={INSURANCE_HINT} autoComplete="off" maxLength={12} value={insuranceValue} className="tw:font-bold"
            onChange={(event) => setInsuranceValue(typed(event.target.value))} />
        </Field>
      </div>
    </Section>
  );
}
