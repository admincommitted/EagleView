import { useState } from 'react';
import { DateInput, Input, SelectBox } from '@/components/ui';
import { ButtonBar, InlineLabel, NumberRow, StockField, StockPanel } from './stockParts';

const SUB_AGENTS = ['Select', 'AGENT A', 'AGENT B'];
const ISSUERS = ['Select'];

// a layout only: nothing on this tab is saved yet
export default function IssueStockSection({ stock }) {
  const [subAgent, setSubAgent] = useState('Select');
  const [issuer, setIssuer] = useState('Select');

  return (
    <StockPanel title="Issue Stock to SubAgent">
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
        <StockField label="Sub Agent" required>
          <SelectBox options={SUB_AGENTS} value={subAgent} onValueChange={setSubAgent} required />
        </StockField>
        <StockField label="Issue Date">
          <DateInput value={stock.stockDate} onValueChange={stock.setStockDate} />
        </StockField>
        <StockField label="Airline/IATA">
          <SelectBox options={ISSUERS} value={issuer} onValueChange={setIssuer} />
        </StockField>
        <StockField label="AirWayBill No" required className="tw:md:col-span-2">
          <NumberRow>
            <Input required placeholder="STARTING NO" className="tw:w-[120px]" />
            <Input required placeholder="ENDING NO" className="tw:w-[120px]" />
            <InlineLabel>Total Count</InlineLabel>
            <Input required placeholder="QTY" className="tw:w-[60px]" />
          </NumberRow>
        </StockField>
      </div>
      <ButtonBar>
        <span className="tw:text-entry tw:font-semibold tw:text-warning">Issuing stock to a sub-agent is not available yet (nothing is saved from this tab).</span>
      </ButtonBar>
    </StockPanel>
  );
}
