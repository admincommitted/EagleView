import { useState } from 'react';
import { DateInput, Input, SelectBox } from '@/components/ui';
import CustomAutocomplete from '../../../CustomAutocomplete';
import { InlineLabel, NumberRow, StockButtons, StockField, StockPanel } from './stockParts';

const PARTY_TYPES = ['Select', 'Airline', 'IATA'];
const NO_ADDRESSES = [];

export default function AwbStockSection({ stock }) {
  const { awb, query } = stock;
  const [airlineAddress, setAirlineAddress] = useState('');
  const [iataAddress, setIataAddress] = useState('');
  const showsAirline = awb.partyType === 'Airline' || awb.partyType === 'IATA';

  return (
    <StockPanel title="AirWayBill Stock">
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
        <StockField label="Party Type" required>
          <SelectBox options={PARTY_TYPES} value={awb.partyType} onValueChange={awb.setPartyType} required />
        </StockField>
        <StockField label="Stock Date">
          <DateInput value={query.fromDate} onValueChange={query.setFromDate} />
        </StockField>

        {showsAirline && (
          <>
            <StockField label="AirLine" required>
              <CustomAutocomplete staticData={stock.airlineOptions} placeholder="SEARCH & SELECT AIRLINE..." onSelect={awb.pickAirline} />
            </StockField>
            <StockField label="AirLine Address">
              <SelectBox options={NO_ADDRESSES} value={airlineAddress} onValueChange={setAirlineAddress} placeholder="Select Address" />
            </StockField>
          </>
        )}

        {awb.partyType === 'IATA' && (
          <>
            <StockField label="IATA" required>
              <CustomAutocomplete staticData={stock.agentOptions} placeholder="SEARCH & SELECT IATA AGENT..." />
            </StockField>
            <StockField label="IATA Address">
              <SelectBox options={NO_ADDRESSES} value={iataAddress} onValueChange={setIataAddress} placeholder="Select Address" />
            </StockField>
          </>
        )}

        <StockField label="AirWayBill No" required className="tw:md:col-span-2">
          <NumberRow>
            <Input required placeholder="3 DIGIT" maxLength={3} className="tw:w-[60px]" value={awb.prefix3} onChange={(event) => awb.setPrefix3(event.target.value.replace(/\D/g, ''))} />
            <Input required placeholder="FIRST 4 DIG" maxLength={4} className="tw:w-[90px]" value={awb.first4} onChange={(event) => awb.changeRun('first4', event.target.value)} />
            <Input required placeholder="LAST 4 DIG" maxLength={4} className="tw:w-[90px]" value={awb.last4} onChange={(event) => awb.changeRun('last4', event.target.value)} />
            <InlineLabel>No of AWB</InlineLabel>
            <Input required placeholder="NO OF" className="tw:w-[60px]" value={awb.count} onChange={(event) => awb.changeRun('count', event.target.value)} />
            <InlineLabel>Last Stock Seq.No</InlineLabel>
            <Input readOnly placeholder="LAST STOCK SEQ.NO" className="tw:min-w-[120px] tw:flex-1" value={awb.lastSeqNo} />
          </NumberRow>
        </StockField>
      </div>

      <StockButtons onSave={awb.save} onClear={awb.clear} changeStock={stock.changeStock} enteredBy={stock.enteredBy} enteredDate={stock.enteredDate} />
    </StockPanel>
  );
}
