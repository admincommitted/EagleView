import { Download, FileText, Save, Search } from 'lucide-react';
import { Button, FileButton, Input, TabsList, TabsTrigger } from '@/components/ui';
import { TACT_TABS } from '../tactTabs';

export default function TactAndIataSection({ ctx }) {
  const { downloadCsv, uploadCsv, reloadFromSql, search, setSearch } = ctx;
  return (
    <>
      <div className="tw:mb-6 tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div>
          <h2 className="tw:m-0 tw:text-lg tw:font-bold tw:text-foreground">TACT & IATA Compliance Masters</h2>
          <p className="tw:mt-1 tw:mb-0 tw:text-entry tw:font-medium tw:text-muted-foreground">Manage Country Rules, Carrier Embargoes, DGR, and Surcharges</p>
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
          <Button variant="warning" size="lg" onClick={downloadCsv}><Download /> Download Data</Button>
          <FileButton variant="success" size="lg" accept=".csv" onFiles={uploadCsv}><FileText /> BULK UPLOAD CSV</FileButton>
          <Button variant="default" size="lg" onClick={reloadFromSql}><Save /> Reload from SQL</Button>
        </div>
      </div>

      <div className="tw:mb-6 tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-border tw:pb-3 tw:lg:flex-row tw:lg:items-end tw:lg:justify-between">
        <TabsList className="tw:h-auto tw:flex-wrap tw:border-b-0">
          {TACT_TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}><Icon /> {label}</TabsTrigger>
          ))}
        </TabsList>
        <Input leftIcon={Search} placeholder="Search records..." data-allow-text="" value={search}
          onChange={(event) => setSearch(event.target.value)} className="tw:h-8 tw:rounded-full tw:lg:w-[250px]" />
      </div>
    </>
  );
}
