import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Download, FileText, PlusCircle, RefreshCw, Save, Search, Settings, Upload, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadBlob } from '@/lib/download';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Card, CardContent, CardHeader, CardTitle, DataTable, FileButton, Input, Separator } from '@/components/ui';
import switchRow, { askDelete } from './switchRow';
import { masterRecordsApi, mastersFormApi } from './masterKit/masterRecordsApi';
import { CheckField, DateField, NumberField, SelectField, TextField } from './masterKit/masterFields';

const EMPTY_HEADER = { id: '', notifNo: '', type: 'CUSTOM', effectiveDate: '', isActive: true };
const EMPTY_DETAIL = { serialNo: '', tariffHead: '', specificSeries: '', dutyRate: 0, itemDescription: '', conditionNo: '', effectiveDate: '' };
const NOTIFICATION_TYPES = [
  { value: 'CUSTOM', label: 'CUSTOM (BCD)' },
  { value: 'IGST', label: 'IGST' },
  { value: 'SWS', label: 'SWS (SURCHARGE)' },
  { value: 'ADD', label: 'ANTI-DUMPING' },
  { value: 'EXCISE', label: 'EXCISE' },
];
const NOTIFICATION_NO = /^\d{1,3}\/\d{4}/;
// IGST notifications from iCAFFE carry up to 20,000 serial rows (009/2025): the grid shows at most this many of the matching rows
const DETAIL_LIMIT = 300;

const TEMPLATE_CSV = 'NotifNo,Type,HeaderDate,SerialNo,TariffHead,SpecificSeries,DutyRate,DetailDate,ItemDescription,ConditionNo\n'
  + '050/2017,CUSTOM,2017-06-30,1,8401,,5.00,2017-06-30,Nuclear reactors,9\n'
  + '011/2018,SWS,2018-02-02,2,2710,,3.00,2018-02-02,Petroleum oils,\n';

// a sheet column is found by its header name, whatever its case / spaces / punctuation
const pickColumn = (sheetRow, ...names) => {
  const header = Object.keys(sheetRow).find((key) => names.includes(key.replace(/[^a-z]/gi, '').toLowerCase()));
  return header ? String(sheetRow[header]).trim() : '';
};

// a tariff head that lost its leading zero in Excel (1011010) gets it back (01011010)
const padTariffHead = (head) => {
  const digits = String(head || '').replace(/\s/g, '');
  return /^\d+$/.test(digits) && [3, 5, 7].includes(digits.length) ? `0${digits}` : digits;
};

const toUploadRow = (sheetRow) => ({
  notifNo: pickColumn(sheetRow, 'notifno', 'notificationno', 'notification'),
  type: (pickColumn(sheetRow, 'type') || 'CUSTOM').toUpperCase(),
  headerDate: pickColumn(sheetRow, 'headerdate', 'notificationdate', 'date'),
  serialNo: pickColumn(sheetRow, 'serialno', 'slno', 'srno', 'serial'),
  tariffHead: padTariffHead(pickColumn(sheetRow, 'tariffhead', 'cth', 'hsn', 'tariffitem')),
  specificSeries: pickColumn(sheetRow, 'specificseries'),
  dutyRate: pickColumn(sheetRow, 'dutyrate', 'rate'),
  detailDate: pickColumn(sheetRow, 'detaildate', 'effectivedate'),
  itemDescription: pickColumn(sheetRow, 'itemdescription', 'description'),
  conditionNo: pickColumn(sheetRow, 'conditionno', 'condition'),
});

const formOf = (form, setForm) => ({ form, setField: (name) => (value) => setForm((current) => ({ ...current, [name]: value })) });

const NOTIFICATION_COLUMNS = [
  { key: 'notifNo', header: 'Notif No', className: 'tw:font-bold' },
  { key: 'type', header: 'Type', className: 'tw:font-semibold tw:text-primary' },
];

export default function DutyNotifMasterForm() {
  const [notifications, setNotifications] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // 'new' or a notification
  const [headerForm, setHeaderForm] = useState(EMPTY_HEADER);
  const [details, setDetails] = useState([]);
  const [detailQuery, setDetailQuery] = useState('');
  const [detailRow, setDetailRow] = useState(EMPTY_DETAIL);
  const detailsRequest = useRef(0);

  const headerReady = Boolean(selected) && selected !== 'new';

  // one notification's serial rows, read when it is picked (all notifications together have 200,000+ rows)
  const loadDetails = async (headerId) => {
    const request = ++detailsRequest.current;
    setDetails([]);
    if (!headerId) return;
    try {
      const rows = await mastersFormApi.dutyNotifDetails(headerId);
      if (request === detailsRequest.current) setDetails(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error(error);
    }
  };

  const showNotification = (notification) => {
    setSelected(notification);
    setHeaderForm(notification);
    loadDetails(notification.id);
  };

  const loadNotifications = async (selection) => {
    try {
      const rows = await mastersFormApi.dutyNotifHeaders();
      setNotifications(rows);
      if (selection && selection !== 'new') {
        const updated = rows.find((notification) => notification.id === selection.id);
        if (updated) showNotification(updated);
      } else if (!selection && rows.length > 0) {
        showNotification(rows[0]);
      }
    } catch (error) {
      toast.error(`Error: could not load notifications - ${errorMessage(error)}`);
    }
  };

  useEffect(() => { loadNotifications(null); }, []);

  const downloadTemplate = () => downloadBlob(new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' }), 'Duty_Notification_Template.csv');

  // CSV or Excel, read with SheetJS so a quoted description with commas ("Nuclear reactors, boilers") stays in one column
  const uploadFile = async ([file]) => {
    if (!file) return;
    let sheetRows;
    try {
      const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', raw: false });
      sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '', raw: false });
    } catch (error) {
      toast.error(`Error: file could not be read - ${error.message}`);
      return;
    }
    const rows = sheetRows.map(toUploadRow).filter((row) => row.notifNo);
    if (!rows.length) {
      toast.error('Error: no rows with a NotifNo column found - use Download Template');
      return;
    }
    try {
      const result = await mastersFormApi.bulkUploadDutyNotifs(rows);
      await loadNotifications(selected);
      toast.success(`Bulk upload successful: ${result.headers || 0} notification(s), ${result.created || 0} serial no(s) added, ${result.updated || 0} updated`);
    } catch (error) {
      toast.error(`Error: upload failed - ${errorMessage(error)}`);
    }
  };

  // the serial no row being edited belongs to the old notification: it is cleared when another one is picked
  const createNew = () => {
    setSelected('new');
    setHeaderForm(EMPTY_HEADER);
    setDetails([]);
    setDetailRow(EMPTY_DETAIL);
  };

  const pickNotification = (notification) => {
    showNotification(notification);
    setDetailRow(EMPTY_DETAIL);
  };

  const clearAll = () => {
    setSelected(null);
    setHeaderForm(EMPTY_HEADER);
    setDetails([]);
  };

  // a notification is switched off / on, not deleted (its serial numbers stay with it)
  const switchHeader = async () => {
    if (!headerForm.id) return;
    const changed = await switchRow('dutynotifs', headerForm, `notification ${headerForm.notifNo || ''} with its ${details.length} serial no(s)`);
    if (!changed) return;
    setHeaderForm({ ...headerForm, isActive: !headerForm.isActive });
    loadNotifications(selected);
  };

  const saveHeader = async () => {
    if (!headerForm.notifNo) {
      toast.error('Please enter the notification no');
      return;
    }
    if (!NOTIFICATION_NO.test(String(headerForm.notifNo).trim())) {
      toast.error('Please enter the notification no like 050/2017');
      return;
    }
    try {
      const saved = headerForm.id
        ? await masterRecordsApi.update('dutynotifs', headerForm.id, headerForm)
        : await masterRecordsApi.create('dutynotifs', headerForm);
      if (selected === 'new') {
        setSelected(saved);
        setHeaderForm(saved);
      }
      await loadNotifications(selected);
      toast.success('Notification saved successfully');
    } catch (error) {
      toast.error(`Error: not saved - ${errorMessage(error)}`);
    }
  };

  const saveDetail = async () => {
    if (!headerReady || !headerForm.id) {
      toast.error('Please save the notification first');
      return;
    }
    if (!detailRow.serialNo) {
      toast.error('Please enter the serial no');
      return;
    }
    try {
      const detail = { ...detailRow, headerId: headerForm.id };
      if (detailRow.id) await masterRecordsApi.update('dutynotifdetails', detailRow.id, detail);
      else await masterRecordsApi.create('dutynotifdetails', detail);
      setDetailRow(EMPTY_DETAIL);
      loadNotifications(selected);
    } catch (error) {
      toast.error(`Error: serial no not saved - ${errorMessage(error)}`);
    }
  };

  const editDetail = (detail) => setDetailRow({
    id: detail.id,
    serialNo: detail.serialNo || '',
    tariffHead: detail.tariffHead || '',
    specificSeries: detail.specificSeries || '',
    dutyRate: detail.dutyRate || 0,
    itemDescription: detail.itemDescription || '',
    conditionNo: detail.conditionNo || '',
    effectiveDate: detail.effectiveDate || '',
  });

  const deleteDetail = async (detail) => {
    if (!(await askDelete('Delete this serial no?'))) return;
    try {
      await masterRecordsApi.remove('dutynotifdetails', detail.id);
      if (detailRow.id === detail.id) setDetailRow(EMPTY_DETAIL);
      loadNotifications(selected);
    } catch (error) {
      toast.error(`Error: not deleted - ${errorMessage(error)}`);
    }
  };

  const shownNotifications = notifications.filter((notification) => notification.notifNo?.toLowerCase().includes(search.toLowerCase()));

  const detailSearch = detailQuery.trim().toLowerCase();
  const matchedDetails = useMemo(() => (detailSearch
    ? details.filter((detail) => String(detail.serialNo || '').toLowerCase().startsWith(detailSearch)
      || String(detail.tariffHead || '').startsWith(detailSearch)
      || String(detail.itemDescription || '').toLowerCase().includes(detailSearch))
    : details), [details, detailSearch]);
  const shownDetails = matchedDetails.slice(0, DETAIL_LIMIT);

  const header = formOf(headerForm, setHeaderForm);
  const detailForm = formOf(detailRow, setDetailRow);

  const detailColumns = [
    { key: 'serialNo', header: 'Serial', className: 'tw:font-bold tw:text-primary' },
    {
      key: 'tariffHead',
      header: 'HSN',
      className: 'tw:font-semibold tw:text-muted-foreground',
      cell: (detail) => `${detail.tariffHead || '-'} ${detail.specificSeries ? `(${detail.specificSeries})` : ''}`,
    },
    {
      key: 'itemDescription',
      header: 'Description',
      className: 'tw:max-w-[200px] tw:truncate tw:text-muted-foreground',
      cell: (detail) => <span title={detail.itemDescription}>{detail.itemDescription || '-'}</span>,
    },
    { key: 'conditionNo', header: 'Cond.', align: 'center', className: 'tw:font-bold tw:text-destructive', cell: (detail) => detail.conditionNo || '-' },
    {
      key: 'dutyRate',
      header: 'Rate %',
      align: 'center',
      className: 'tw:font-bold tw:text-primary',
      cell: (detail) => (detail.dutyRate === null || detail.dutyRate === undefined || detail.dutyRate === '' ? '-' : `${detail.dutyRate}%`),
    },
    {
      key: 'effectiveDate',
      header: 'Date',
      align: 'center',
      className: 'tw:text-muted-foreground',
      cell: (detail) => (detail.effectiveDate ? String(detail.effectiveDate).slice(0, 10).split('-').reverse().join('-') : '-'),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      cell: (detail) => (
        <span className="tw:inline-flex tw:gap-1">
          <Button variant="link" size="sm" onClick={() => editDetail(detail)}>EDIT</Button>
          <Button variant="link" size="sm" className="tw:text-destructive" onClick={() => deleteDetail(detail)}>REMOVE</Button>
        </span>
      ),
    },
  ];

  const detailEmptyText = !headerReady ? 'PLEASE SELECT OR CREATE A NOTIFICATION HEADER FIRST.'
    : details.length ? 'NO SERIAL MATCHES THE SEARCH.' : 'NO SERIAL NUMBERS ADDED YET.';

  return (
    <div className="tw:flex tw:flex-col tw:gap-4 tw:lg:h-full tw:lg:min-h-0 tw:lg:flex-row">
      <Card className="tw:flex tw:max-h-[40vh] tw:flex-col tw:gap-0 tw:overflow-hidden tw:p-0 tw:lg:max-h-none tw:lg:w-[280px] tw:lg:shrink-0">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:p-3">
          <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-[13px] tw:font-bold tw:tracking-[0.5px] tw:text-head tw:uppercase">
            <Search className="tw:size-4 tw:text-primary" /> Search Notification ({shownNotifications.length})
          </h3>
          <Input leftIcon={Search} data-allow-text="" placeholder="Search Notification No..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <DataTable columns={NOTIFICATION_COLUMNS} rows={shownNotifications} selectedKey={headerReady ? selected.id : undefined}
          onRowClick={pickNotification} emptyText="No records found." containerClassName="tw:min-h-0 tw:flex-1" />
      </Card>

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-4 tw:pb-4 tw:lg:overflow-y-auto">
        <Card>
          <CardHeader className="tw:flex-wrap tw:border-b tw:border-border tw:bg-primary/5 tw:py-2">
            <CardTitle icon={<FileText />}>NOTIFICATION</CardTitle>
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              <Button title="Download Template" onClick={downloadTemplate}><Download /> TEMPLATE</Button>
              <FileButton accept=".csv,.xlsx,.xls" variant="success" onFiles={uploadFile}><Upload /> BULK UPLOAD</FileButton>
              <Separator orientation="vertical" className="tw:h-6" />
              <Button className="tw:border-dashed tw:border-primary tw:text-primary" onClick={createNew}><PlusCircle /> CREATE NEW</Button>
              <Button variant="secondary" onClick={clearAll}><RefreshCw /> CLEAR</Button>
              {headerForm.id && <Button className="tw:text-warning" onClick={switchHeader}>{headerForm.isActive ? 'SWITCH OFF' : 'SWITCH ON'}</Button>}
              <Button variant="default" onClick={saveHeader}><Save /> SAVE</Button>
            </div>
          </CardHeader>
          <CardContent className="tw:pt-3">
            <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-[1.5fr_1fr_1fr_0.5fr]">
              <TextField master={header} name="notifNo" label="Notification No" required upper placeholder="E.G. 050/2017" />
              <SelectField master={header} name="type" label="Type" required options={NOTIFICATION_TYPES} />
              <DateField master={header} name="effectiveDate" label="Effective Date" required />
              <CheckField master={header} label="Active" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn('tw:flex-1', !headerReady && 'tw:pointer-events-none tw:opacity-60')}>
          <CardHeader className="tw:border-b tw:border-border tw:bg-page tw:py-2">
            <CardTitle icon={<Settings />} className="tw:text-muted-foreground">NOTIFICATION SERIAL NUMBERS</CardTitle>
          </CardHeader>
          <CardContent className="tw:gap-3 tw:pt-3">
            <div className="tw:flex tw:flex-col tw:gap-4 tw:rounded-md tw:border tw:border-dashed tw:border-border tw:bg-secondary tw:p-4">
              <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-5">
                <TextField master={detailForm} name="serialNo" label="Serial No" required upper placeholder="E.G. 1, 2A" />
                <TextField master={detailForm} name="tariffHead" label="Tariff Head" placeholder="HSN CODE" />
                <TextField master={detailForm} name="specificSeries" label="Series" placeholder="OPTIONAL" />
                <NumberField master={detailForm} name="dutyRate" label="Rate (%)" placeholder="0.00" />
                <DateField master={detailForm} name="effectiveDate" label="Effective Date" />
              </div>
              <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-4 tw:md:grid-cols-[3fr_1fr_auto]">
                <TextField master={detailForm} name="itemDescription" label="Item Description (Goods)" placeholder="Description of goods exempted..." />
                <TextField master={detailForm} name="conditionNo" label="Condition No." placeholder="E.g., 9" />
                <Button variant={detailRow.id ? 'success' : 'outline'} onClick={saveDetail}>{detailRow.id ? '✓ UPDATE' : '+ ADD SERIAL'}</Button>
              </div>
            </div>

            <div className="tw:flex tw:flex-col tw:gap-2.5 tw:sm:flex-row tw:sm:items-center">
              <div className="tw:w-full tw:sm:max-w-[320px]">
                <Input data-allow-text="" placeholder="SEARCH SERIAL / HSN / DESCRIPTION" value={detailQuery} onChange={(event) => setDetailQuery(event.target.value)} />
              </div>
              <span className="tw:text-[11px] tw:font-semibold tw:text-muted-foreground">
                {matchedDetails.length > shownDetails.length
                  ? `Showing ${shownDetails.length} of ${matchedDetails.length} serial rows - search to narrow`
                  : `${matchedDetails.length} serial row(s)`}
              </span>
            </div>
            <DataTable columns={detailColumns} rows={shownDetails} emptyText={detailEmptyText} containerClassName="tw:flex-1 tw:rounded-md tw:border tw:border-border" />

            <p className="tw:m-0 tw:flex tw:items-center tw:gap-1.5 tw:text-[11px] tw:text-muted-foreground">
              <Zap className="tw:size-3.5 tw:text-primary" /> * IN JOB ENTRY, ENTERING NOTIFICATION NO WILL INSTANTLY FETCH THESE EXACT SERIAL NUMBERS.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
