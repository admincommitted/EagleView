import { Badge, DataTable } from '@/components/ui';

export default function TactRecordsSection({ ctx }) {
  const { tab, visibleRows, setSelectedAircraft } = ctx;
  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <h3 className="tw:m-0 tw:text-lg tw:font-bold">{tab.title}</h3>
        <Badge className="tw:text-entry">{tab.countLabel || 'Total Records'}: {visibleRows.length}</Badge>
      </div>
      <DataTable columns={tab.columns} rows={visibleRows} className="tw:text-entry"
        onRowClick={tab.opensAircraft ? setSelectedAircraft : undefined}
        containerClassName="tw:max-h-[calc(100vh-380px)] tw:rounded-lg tw:border tw:border-border" />
    </div>
  );
}
