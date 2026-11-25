import { DateInput, Input, SelectBox } from '@/components/ui';
import CustomAutocomplete from '../../../CustomAutocomplete';
import { InlineLabel, NumberRow, StockButtons, StockField, StockPanel } from './stockParts';

const PARTY_TYPES = ['Select', 'Consolidator', 'Agent'];

export default function HawbStockSection({ stock }) {
  const { hawb } = stock;
  const hasParty = hawb.partyType === 'Consolidator' || hawb.partyType === 'Agent';

  return (
    <StockPanel title="HAWB Stock">
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
        <StockField label="Party Type" required>
          <SelectBox options={PARTY_TYPES} value={hawb.partyType} onValueChange={hawb.setPartyType} required />
        </StockField>
        <StockField label="Stock Date">
          <DateInput value={stock.stockDate} onValueChange={stock.setStockDate} />
        </StockField>

        {hasParty ? (
          <StockField label={`${hawb.partyType} Name`} required>
            <CustomAutocomplete staticData={hawb.partyType === 'Agent' ? stock.agentOptions : stock.consolidatorOptions}
              onSelect={(option) => hawb.setPartyId(option.id)} placeholder={`SEARCH & SELECT ${String(hawb.partyType).toUpperCase()}...`} />
          </StockField>
        ) : <div className="tw:hidden tw:md:block" />}

        <StockField label="HAWB No" required className="tw:md:col-span-2">
          <NumberRow>
            <Input required placeholder="PREFIX" title="Optional letters in front of the number, e.g. HBL" maxLength={10} data-allow-text="" className="tw:w-[80px]"
              value={hawb.prefix} onChange={(event) => hawb.setPrefix(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} />
            <Input required placeholder="STARTING NO" className="tw:w-[130px]" value={hawb.startNo} onChange={(event) => hawb.setStartNo(event.target.value.replace(/\D/g, ''))} />
            <Input readOnly placeholder="ENDING NO" title="Worked out from Starting No + No of HAWB" className="tw:w-[130px]" value={hawb.endNo} />
            <InlineLabel>No of HAWB</InlineLabel>
            <Input required placeholder="COUNT" maxLength={6} className="tw:w-[80px]" value={hawb.count} onChange={(event) => hawb.setCount(event.target.value.replace(/\D/g, ''))} />
          </NumberRow>
        </StockField>
      </div>

      <StockButtons onSave={hawb.save} onClear={hawb.clear} changeStock={stock.changeStock} enteredBy={stock.enteredBy} enteredDate={stock.enteredDate} />
    </StockPanel>
  );
}
