// Customs > BE Amendments - register of BE amendments (iCAFFE "Submit BE Amend"): Not sent / Sent / All, search, and one
// amendment at a time on the right: changes, codes, file (unsigned, signed with the DSC token, or mailed to ICEGATE).
import { useCallback, useEffect, useState } from 'react';
import { Search, Settings, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, DataTable, DateInput, Input, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { cn } from '@/lib/utils';
import { beAmendApi } from '../components/BeAmendment/beAmendApi';
import AmendmentDetail from '../components/BeAmendment/AmendmentDetail';
import AmendmentSettingsPanel from './BeAmendmentsParts/AmendmentSettingsPanel';
import { emptyListText, LIST_TABS, listColumns, tabCount } from './BeAmendmentsParts/amendmentList';

const openJob = (id) => window.location.assign('/job-entry?openJob=' + id);

export default function BeAmendments() {
  const [tab, setTab] = useState('open');
  const [searchText, setSearchText] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);
  const [mailTo, setMailTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters = { status: tab };
      if (searchText.trim()) filters.q = searchText.trim();
      if (fromDate) filters.from = fromDate;
      if (toDate) filters.to = toDate;
      const answer = await beAmendApi.list(filters);
      setRows(answer.data || []);
      setCounts(answer.counts || {});
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [tab, searchText, fromDate, toDate]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- reloads on a tab change; the search boxes wait for Search
  useEffect(() => { load(); }, [tab]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const answer = await beAmendApi.settings();
        setSettings(answer);
        setMailTo(answer.mailTo || '');
      } catch {
        setSettings(null);
      }
    };
    loadSettings();
  }, []);

  const changeTab = (nextTab) => { setTab(nextTab); setSelectedId(null); };

  const saveMailTo = async () => {
    try {
      const answer = await beAmendApi.saveMailTo(mailTo);
      setSettings((current) => ({ ...current, mailTo: answer.mailTo }));
      toast.success('ICEGATE mail address saved');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const updateRow = (changed) => {
    if (changed) setRows((current) => current.map((row) => (row.id === changed.id ? { ...row, ...changed } : row)));
  };

  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:gap-2.5 tw:bg-page tw:px-4 tw:py-3">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <h2 className="tw:m-0 tw:text-[16px] tw:text-foreground">BE Amendments</h2>
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList variant="pill">
            {LIST_TABS.map((listTab) => (
              <TabsTrigger key={listTab.value} value={listTab.value} className="tw:font-semibold">
                {listTab.label} <span className="tw:font-medium tw:opacity-75">{tabCount(listTab.value, counts)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form onSubmit={(event) => { event.preventDefault(); load(); }} className="tw:flex tw:w-full tw:flex-wrap tw:items-center tw:gap-1.5 tw:md:w-auto">
          <Input
            leftIcon={Search}
            className="tw:w-full tw:md:w-[240px]"
            placeholder="Amend no, BE no, job no, importer, code"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <DateInput wrapperClassName="tw:w-32" placeholder="From" value={fromDate} onValueChange={setFromDate} />
          <DateInput wrapperClassName="tw:w-32" placeholder="To" value={toDate} onValueChange={setToDate} />
          <Button type="submit" variant="default">{loading ? 'Loading…' : 'Search'}</Button>
        </form>
        <Button className="tw:ml-auto" onClick={() => setShowSettings((shown) => !shown)}><Settings /> Settings</Button>
      </div>

      {showSettings && settings && (
        <AmendmentSettingsPanel settings={settings} mailTo={mailTo} onMailToChange={setMailTo} onSaveMailTo={saveMailTo} />
      )}

      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-3 tw:lg:flex-row">
        <div className={cn('tw:min-w-0 tw:overflow-auto tw:rounded-md tw:border tw:border-border tw:bg-card', selectedId ? 'tw:lg:basis-[44%] tw:lg:shrink-0' : 'tw:flex-1')}>
          <DataTable
            columns={listColumns(Boolean(selectedId))}
            rows={rows}
            selectedKey={selectedId}
            onRowClick={(row) => setSelectedId(row.id)}
            emptyText={emptyListText(loading, tab)}
          />
        </div>
        {selectedId && (
          <div className="tw:relative tw:min-w-0 tw:flex-1 tw:overflow-auto tw:rounded-md tw:border tw:border-border tw:bg-page tw:p-3">
            <Button variant="ghost" size="icon" aria-label="Close" className="tw:absolute tw:top-2 tw:right-2" onClick={() => setSelectedId(null)}><X /></Button>
            <AmendmentDetail key={selectedId} id={selectedId} onOpenJob={openJob} onChanged={updateRow} />
          </div>
        )}
      </div>
    </div>
  );
}
