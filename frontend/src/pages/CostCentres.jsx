import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Plus, Printer, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { askText } from '@/components/common/askConfirm';
import { Button, DataTable } from '@/components/ui';
import { accountsApi } from './AccountsHubParts/accountsApi';
import { ReportFrame, ReportMessage, ReportPage, ReportSheet } from './LedgerReportParts/ReportLayout';
import { PeriodFilter } from './LedgerReportParts/ReportFilters';
import { financialYearStart, formatAmount, periodText, todayIso } from './LedgerReportParts/format';
import { assertSuccess, emptyOnFailure, exportSheet } from './LedgerReportParts/reportData';

// sub-centres can nest under a centre; they are listed indented instead of hidden
const flattenCentres = (centres, depth) => (centres || []).flatMap((centre) => [{ ...centre, depth }, ...flattenCentres(centre.children, depth + 1)]);

const openCategories = (categories) =>
  Object.fromEntries(categories.filter((category) => category.children?.length).map((category) => [category.id, true]));

const amountOrDash = (amount) => (amount ? formatAmount(amount) : '-');

const COLUMNS = [
  {
    key: 'name',
    header: 'Cost Category / Centre Name',
    cell: (row) => (row.isCategory ? (
      <span className="tw:flex tw:items-center tw:gap-1.5 tw:text-[13px] tw:font-bold tw:text-foreground">
        <span className="tw:flex tw:text-primary">{row.expanded ? <ChevronDown className="tw:size-3.5" /> : <ChevronRight className="tw:size-3.5" />}</span>
        {row.name} (Category)
      </span>
    ) : (
      <span className="tw:block tw:pl-(--indent) tw:text-[13px] tw:font-medium tw:text-muted-foreground" style={{ '--indent': `${24 + row.depth * 18}px` }}>{row.name}</span>
    )),
  },
  {
    key: 'amount',
    header: 'Allocated Amount (₹)',
    align: 'right',
    width: 200,
    cell: (row) => (
      <span className={cn('tw:text-[13px]', row.isCategory ? 'tw:font-bold tw:text-foreground' : 'tw:font-medium', !row.isCategory && (row.amount < 0 ? 'tw:text-destructive' : 'tw:text-muted-foreground'))}>
        {amountOrDash(row.amount)}
      </span>
    ),
  },
];

const breakupRows = (categories, expanded) => categories.flatMap((category) => [
  { ...category, key: `category-${category.id}`, isCategory: true, expanded: expanded[category.id] },
  ...(expanded[category.id] ? flattenCentres(category.children, 0).map((centre) => ({ ...centre, key: `centre-${centre.id}` })) : []),
]);

function CountsNote({ counts }) {
  return (
    <div className="tw:border-t tw:border-border tw:bg-page tw:px-4 tw:py-2.5 tw:text-entry tw:text-muted-foreground">
      {counts.categories} categor{counts.categories === 1 ? 'y' : 'ies'}, {counts.centres} centre(s),
      {' '}{counts.taggedLines} tagged voucher line(s).
      {counts.untaggedLines ? (
        <span className="tw:text-warning"> {counts.untaggedLines} line(s) in this period carry no cost centre, so they are in none of these figures.</span>
      ) : null}
    </div>
  );
}

export default function CostCentres() {
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(financialYearStart);
  const [to, setTo] = useState(todayIso);
  const [costCategories, setCostCategories] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reportBody, mastersBody] = await Promise.all([
        accountsApi.ledgerReportCostCentres({ from, to }),
        emptyOnFailure(accountsApi.accountingMasters()),
      ]);
      assertSuccess(reportBody);
      setCategories(reportBody.data || []);
      setMeta(reportBody);
      setCostCategories(mastersBody.data?.costCategories || []);
      setExpanded(openCategories(reportBody.data || []));
    } catch (loadError) {
      setCategories([]);
      setMeta(null);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const addCategory = async () => {
    const name = await askText({
      title: 'Add cost category',
      label: 'New cost category name',
      placeholder: 'e.g. Branches, Departments, Projects',
      okLabel: 'Create',
    });
    if (!name) return;
    try {
      assertSuccess(await accountsApi.ledgerReportCreateCostCategory({ name }));
      toast.success(`Category "${name}" created`);
      await load();
    } catch (saveError) {
      toast.error(`Not created: ${errorMessage(saveError)}`);
    }
  };

  const addCentre = async () => {
    if (!costCategories.length) return toast.error('Create a cost category first - a centre has to sit under one');
    const name = await askText({ title: 'Add cost centre', label: 'New cost centre name', placeholder: 'e.g. Delhi Office', okLabel: 'Next' });
    if (!name) return;
    const categoryId = await askText({
      title: 'Add cost centre',
      message: 'Which category does it belong to?',
      choices: costCategories.map((category) => ({ value: category.id, label: category.name })),
      okLabel: 'Create',
    });
    const category = costCategories.find((candidate) => String(candidate.id) === categoryId);
    if (!category) return toast.error('No category picked - nothing created');
    try {
      assertSuccess(await accountsApi.ledgerReportCreateCostCentre({ name, categoryId: category.id }));
      toast.success(`Centre "${name}" created under ${category.name}`);
      await load();
    } catch (saveError) {
      toast.error(`Not created: ${errorMessage(saveError)}`);
    }
  };

  const exportExcel = async () => {
    if (!categories.length) return toast.error('Nothing to export');
    const rows = [];
    const addRows = (nodes, depth) => (nodes || []).forEach((node) => {
      rows.push({ 'Category / Centre': '    '.repeat(depth) + node.name + (node.type === 'category' ? ' (Category)' : ''), 'Allocated (INR)': node.amount });
      addRows(node.children, depth + 1);
    });
    addRows(categories, 0);
    await exportSheet({ rows, sheetName: 'Cost Centres', fileName: `cost-centres-${from}-to-${to}.xlsx`, columnWidths: [48, 18] });
  };

  const toggleCategory = (row) => {
    if (row.isCategory) setExpanded((current) => ({ ...current, [row.id]: !current[row.id] }));
  };

  const actions = (
    <>
      <PeriodFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} separator="to" />
      <Button variant="default" onClick={addCategory}><Plus /> Add Category</Button>
      <Button variant="success" onClick={addCentre}><Plus /> Add Centre</Button>
      <Button onClick={exportExcel}><Download /> Export</Button>
      <Button onClick={() => window.print()}><Printer /> Print</Button>
    </>
  );

  return (
    <ReportPage icon={Settings} title="Cost Centres" subtitle="Category & Centre Management" actions={actions}>
      <ReportFrame>
        {loading && <ReportMessage tone="loading">Loading Cost Centres...</ReportMessage>}
        {!loading && error && <ReportMessage tone="error">Could not load: {error}</ReportMessage>}
        {!loading && !error && (
          <ReportSheet title="Cost Centre Breakup" subtitle={periodText(from, to)}>
            <DataTable
              columns={COLUMNS}
              rows={breakupRows(categories, expanded)}
              rowKey="key"
              onRowClick={toggleCategory}
              rowClassName={(row) => row.isCategory && 'tw:bg-muted tw:even:bg-muted'}
              emptyText={meta?.note || 'No cost categories or centres yet.'}
              stickyHeader={false}
            />
            {meta && categories.length > 0 && <CountsNote counts={meta.counts} />}
          </ReportSheet>
        )}
      </ReportFrame>
    </ReportPage>
  );
}
