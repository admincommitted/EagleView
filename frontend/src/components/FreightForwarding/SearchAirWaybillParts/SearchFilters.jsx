import { FileSpreadsheet, Printer, RefreshCw, Search } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, ComboInput, DateInput, Field, Input, SelectBox } from '@/components/ui';
import { ChoiceGroup } from '../AirExportParts/widgets';
import { DATE_BASIS_OPTIONS, NATURE_OPTIONS, ROUTING_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS } from './searchConfig';

const AUTOCOMPLETE_FIELDS = [
  { key: 'awbNo', label: 'AWB NO', list: 'awbNumbers' },
  { key: 'hawbNo', label: 'HAWB NO', list: 'hawbNumbers' },
];

const PARTY_FIELDS = [
  { key: 'airline', label: 'AIRLINE', list: 'airlines' },
  { key: 'shipper', label: 'SHIPPER', list: 'shippers' },
  { key: 'consignee', label: 'CONSIGNEE', list: 'consignees' },
];

const airportCode = (text) => text.toUpperCase().replace(/[^A-Z]/g, '');

export default function SearchFilters({ filters, setFilter, pickLists, onSearch, onClear, onPrint, onExcel, hasRows }) {
  const searchOnEnter = (event) => event.key === 'Enter' && onSearch();
  const comboFor = ({ key, label, list }) => (
    <Field key={key} label={label} layout="col">
      <ComboInput options={pickLists[list]} value={filters[key]} onValueChange={(text) => setFilter(key, text)} />
    </Field>
  );

  return (
    <Card>
      <CardHeader className="tw:flex-wrap tw:border-b tw:border-border tw:py-1.5">
        <CardTitle className="tw:mr-auto tw:text-sm tw:uppercase">Airwaybill Query</CardTitle>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <Button variant="default" onClick={onSearch}><Search /> QUERY</Button>
          <Button variant="secondary" onClick={onClear}><RefreshCw /> CLEAR</Button>
          <Button disabled={!hasRows} onClick={onPrint}><Printer /> PRINT</Button>
          <Button variant="success" disabled={!hasRows} onClick={onExcel}><FileSpreadsheet /> EXCEL</Button>
        </div>
      </CardHeader>

      <div className="tw:flex tw:flex-col tw:gap-2 tw:px-3 tw:py-2">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-6 tw:gap-y-1.5">
          <ChoiceGroup label="TYPE" value={filters.awbType} onValueChange={(value) => setFilter('awbType', value)} options={TYPE_OPTIONS} />
          <ChoiceGroup label="NATURE" value={filters.awbNature} onValueChange={(value) => setFilter('awbNature', value)} options={NATURE_OPTIONS} />
          <ChoiceGroup label="ROUTING" value={filters.routing} onValueChange={(value) => setFilter('routing', value)} options={ROUTING_OPTIONS} />
        </div>

        <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(138px,1fr))] tw:gap-x-2.5 tw:gap-y-1.5">
          <Field label="FROM" layout="col"><DateInput value={filters.fromDate} onValueChange={(value) => setFilter('fromDate', value)} /></Field>
          <Field label="TO" layout="col"><DateInput value={filters.toDate} onValueChange={(value) => setFilter('toDate', value)} /></Field>
          <Field label="DATE IS" layout="col">
            <SelectBox value={filters.dateBasis} onValueChange={(value) => setFilter('dateBasis', value)} options={DATE_BASIS_OPTIONS} />
          </Field>
          {AUTOCOMPLETE_FIELDS.map(comboFor)}
          <Field label="FLIGHT NO" layout="col">
            <Input data-allow-text value={filters.flightNo} placeholder="EK511" onKeyDown={searchOnEnter} onChange={(event) => setFilter('flightNo', event.target.value.toUpperCase())} />
          </Field>
          {PARTY_FIELDS.map(comboFor)}
          <Field label="ORIGIN" layout="col">
            <Input data-allow-text value={filters.origin} maxLength={3} placeholder="DEL" onKeyDown={searchOnEnter} onChange={(event) => setFilter('origin', airportCode(event.target.value))} />
          </Field>
          <Field label="DESTINATION" layout="col">
            <Input data-allow-text value={filters.destination} maxLength={3} placeholder="DXB" onKeyDown={searchOnEnter} onChange={(event) => setFilter('destination', airportCode(event.target.value))} />
          </Field>
          <Field label="STATUS" layout="col">
            <SelectBox value={filters.stage} onValueChange={(value) => setFilter('stage', value)} options={STATUS_OPTIONS} />
          </Field>
        </div>
      </div>
    </Card>
  );
}
