import { Search } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, ComboInput, DateInput, Field, Input, SelectBox } from '@/components/ui';
import { DATE_TYPE_OPTIONS, DOCUMENT_TYPE_OPTIONS, STATUS_OPTIONS } from './trackConfig';

export default function TrackFilters({ filters, setFilter, pickLists, onSearch, onClear }) {
  const field = (key) => ({ value: filters[key], onValueChange: (value) => setFilter(key, value) });
  const airportField = (key) => ({ ...field(key), options: pickLists.airports, maxLength: 3 });

  return (
    <Card>
      <CardHeader className="tw:border-b tw:border-border tw:py-2">
        <CardTitle className="tw:text-[15px] tw:uppercase">SEARCH CRITERIA</CardTitle>
      </CardHeader>
      <CardContent className="tw:gap-2.5 tw:px-4 tw:pt-3">
        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
          <Field label="DOCUMENT TYPE" layout="col"><SelectBox {...field('documentType')} options={DOCUMENT_TYPE_OPTIONS} /></Field>
          <Field label="AIRLINE NAME" layout="col"><ComboInput {...field('airline')} options={pickLists.airlines} /></Field>
          <Field label="AWB / HAWB NUMBER" layout="col"><ComboInput {...field('awbNumber')} options={pickLists.awbNumbers} /></Field>
          <Field label="STATUS" layout="col"><SelectBox {...field('status')} options={STATUS_OPTIONS} /></Field>
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-[1fr_1fr_1fr_1fr_0.5fr_0.5fr]">
          <Field label="ORIGIN" layout="col"><ComboInput {...airportField('origin')} /></Field>
          <Field label="DESTINATION" layout="col"><ComboInput {...airportField('destination')} /></Field>
          <Field label="SHIPPER / CONSIGNEE" layout="col">
            <Input
              data-allow-text
              value={filters.shipper}
              placeholder="Name contains"
              onChange={(event) => setFilter('shipper', event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && onSearch()}
            />
          </Field>
          <Field label="DATE TYPE" layout="col"><SelectBox {...field('dateType')} options={DATE_TYPE_OPTIONS} /></Field>
          <Field label="FROM DATE" layout="col"><DateInput {...field('fromDate')} /></Field>
          <Field label="TO DATE" layout="col"><DateInput {...field('toDate')} /></Field>
        </div>

        <div className="tw:mt-2 tw:flex tw:justify-end tw:gap-4">
          <Button variant="destructive" onClick={onClear}>CLEAR</Button>
          <Button variant="default" onClick={onSearch}><Search /> SEARCH</Button>
        </div>
      </CardContent>
    </Card>
  );
}
