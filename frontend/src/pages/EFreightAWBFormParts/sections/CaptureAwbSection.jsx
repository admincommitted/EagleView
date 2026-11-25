import { useState } from 'react';
import { Edit2, Plane } from 'lucide-react';
import { Badge, Button, ComboInput } from '@/components/ui';
import { formatAwbNumber } from '../awbFormat';

const airlineLogoOf = (airline) => airline.customLogo || (airline.code2 ? `https://pics.avs.io/200/200/${airline.code2}.png` : null);

function AirlineBadge({ airline }) {
  const logo = airlineLogoOf(airline);
  const [failedLogo, setFailedLogo] = useState(null);
  return (
    <div className="tw:ml-2 tw:flex tw:shrink-0 tw:items-center tw:gap-1.5 tw:border-l tw:border-border tw:pl-2">
      {logo && failedLogo !== logo
        ? <img src={logo} alt={airline.name} className="tw:h-8 tw:w-auto tw:rounded-[2px] tw:object-contain" onError={() => setFailedLogo(logo)} />
        : <Plane className="tw:size-4 tw:text-primary" />}
      <span className="tw:text-sm tw:font-bold tw:whitespace-nowrap tw:text-foreground tw:uppercase">{airline.name}</span>
    </div>
  );
}

const InfoItem = ({ label, children }) => (
  <div className="tw:min-w-0">
    <div className="tw:mb-1 tw:text-[11px] tw:font-bold tw:tracking-[0.5px] tw:text-primary tw:uppercase">{label}</div>
    <div className="tw:flex tw:items-center tw:gap-2 tw:font-bold">{children}</div>
  </div>
);

const EditButton = ({ label, onClick }) => (
  <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}><Edit2 className="tw:text-primary" /></Button>
);

export default function CaptureAwbSection({ ctx }) {
  const { airlines, awbStocks, iataAgents, watchedAwb, selectedIataAgentName, setValue, openDrawer, printAwb, handleSubmit, onSubmit } = ctx;
  const airline = airlines.find((candidate) => candidate.prefix === (watchedAwb || '').substring(0, 3));
  const agent = iataAgents.find((candidate) => candidate.name === selectedIataAgentName);

  return (
    <>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:border-b tw:border-border tw:bg-linear-to-r tw:from-card tw:to-page tw:px-4 tw:py-4 tw:shadow-xs tw:md:px-6">
        <h2 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-xl tw:font-bold tw:text-foreground"><Plane className="tw:size-6 tw:text-primary" /> Capture AWB</h2>
        <div className="tw:flex tw:gap-2.5">
          <Button size="lg" onClick={printAwb}>Print</Button>
          <Button size="lg" variant="default" onClick={handleSubmit(onSubmit)}>Save</Button>
        </div>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:border-b tw:border-border tw:bg-card tw:px-4 tw:py-4 tw:text-[13px] tw:sm:grid-cols-2 tw:md:px-6 tw:lg:grid-cols-[3.5fr_1.5fr_1fr_1fr_0.8fr]">
        <InfoItem label="AWB NUMBER">
          <ComboInput
            options={awbStocks.map((stock) => formatAwbNumber(stock.fullAwbNumber))}
            value={watchedAwb || ''}
            onValueChange={(text) => setValue('awbNumber', text)}
            placeholder="Select AWB No"
            className="tw:w-full tw:flex-none tw:md:w-[120px]"
          />
          <EditButton label="AWB details" onClick={() => openDrawer('awb')} />
          {airline && <AirlineBadge airline={airline} />}
        </InfoItem>

        <InfoItem label="IATA AGENT NAME">
          <ComboInput
            options={iataAgents.map((iataAgent) => iataAgent.name)}
            value={selectedIataAgentName || ''}
            onValueChange={(text) => setValue('iataAgent', text)}
            placeholder="Select IATA Agent"
            className="tw:w-full tw:md:w-[280px] tw:md:flex-none"
          />
          <EditButton label="IATA agent details" onClick={() => openDrawer('iata')} />
        </InfoItem>

        <InfoItem label="STATION">DEL</InfoItem>
        <InfoItem label="IATA CODE">{agent ? agent.iataCode : '---'}</InfoItem>
        <InfoItem label="STATUS"><Badge>NEW</Badge></InfoItem>
      </div>
    </>
  );
}
