import { Download, Edit, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadBlob } from '@/lib/download';
import { Button, DataTable, DateInput, Field, Input, Modal, Tabs, TabsList, TabsTrigger, Textarea } from '@/components/ui';

const ETP_FIELDS = [
  { key: 'JobNo', label: 'Job No', required: true },
  { key: 'JobDate', label: 'Job Date', required: true, isDate: true },
  { key: 'SiteId', label: 'Site Id', required: true },
  { key: 'GatewayPort', label: 'Gateway Port', required: true },
  { key: 'StuffPort', label: 'Stuff Port', required: true },
  { key: 'CarrierCode', label: 'Carrier Code', required: true },
  { key: 'PortOfDischarge', label: 'Port Of Discharge', required: true },
  { key: 'CarrierNumber', label: 'Carrier Number', required: true },
  { key: 'BondCode', label: 'Bond Code', required: true },
  { key: 'BondNumber', label: 'Bond Number', required: true, wide: true },
  { key: 'BondDate', label: 'Bond Date', required: true, isDate: true },
  { key: 'BondSite', label: 'Bond Site', required: true },
  { key: 'ExpTransShippmentDate', label: 'Exp.Trans. Shippment Date', isDate: true },
  { key: 'ExpTransShippmentNo', label: 'Exp.Trans Shippment No.' },
  { key: 'AirWayBillNo', label: 'Airway Bill No.' },
];

const NFEI_CATEGORIES = [
  { code: '04', desc: 'CURRENCY CHEST' },
  { code: '05', desc: 'TOURIST GOODS' },
  { code: '06', desc: 'DEFENCE GOODS' },
  { code: '07', desc: 'GIFT PARCEL' },
  { code: '08', desc: 'OTHERS' },
  { code: '09', desc: 'FOR SEZ DTA ONLY' },
  { code: '01', desc: 'FREE TRADE SAMPLE' },
  { code: '02', desc: 'DIPLOMATIC GOODS' },
  { code: '03', desc: 'WARRANTY REPLACEMENT' },
];

function EtpModal({ ctx }) {
  const { isEtpModalOpen, setIsEtpModalOpen, etpDetails, setEtpDetails, saveEtp } = ctx;
  const setEtpField = (key) => (value) => setEtpDetails((prev) => ({ ...prev, [key]: value }));
  const downloadJson = () => downloadBlob(new Blob([JSON.stringify(etpDetails, null, 2)], { type: 'application/json' }), 'etp_details.json');
  const footer = (
    <>
      <Button variant="success" onClick={saveEtp}>OK</Button>
      <Button onClick={() => setIsEtpModalOpen(false)}>CANCEL</Button>
    </>
  );

  return (
    <Modal open={isEtpModalOpen} title="ETP Master Details" width={800} onClose={() => setIsEtpModalOpen(false)} footer={footer} closeOnOutside={false}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-3">
        {ETP_FIELDS.map(({ key, label, required, isDate, wide }) => (
          <Field key={key} label={label} required={required} layout="col" className={cn(wide && 'tw:md:col-span-3')}>
            {isDate
              ? <DateInput required={required} value={etpDetails[key] || ''} onValueChange={setEtpField(key)} />
              : <Input required={required} value={etpDetails[key] || ''} onChange={(event) => setEtpField(key)(event.target.value)} />}
          </Field>
        ))}
      </div>
      <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-3">
        <Button variant="success" onClick={saveEtp}><Save /> SAVE</Button>
        <Button variant="success" onClick={saveEtp}><Edit /> UPDATE</Button>
        <Button variant="default" onClick={downloadJson}><Download /> DOWNLOAD JSON</Button>
      </div>
    </Modal>
  );
}

function NfeiCategoryModal({ ctx }) {
  const { isCategoryModalOpen, setIsCategoryModalOpen, exportData, setExportData, setField, handleChange } = ctx;
  const searchBy = exportData.catSearch === 'DESCRIPTION' ? 'DESCRIPTION' : 'CODE';
  const term = String(exportData.enterFilter || '').toLowerCase();
  const rows = NFEI_CATEGORIES.filter((category) => !term || (searchBy === 'DESCRIPTION' ? category.desc : category.code).toLowerCase().includes(term));
  const columns = [
    {
      key: 'picked', header: '', width: 44, align: 'center',
      cell: (category) => <span className={cn('tw:inline-block tw:size-3.5 tw:rounded-sm tw:border-2 tw:border-input', exportData.nfeiCategoryCode === category.code && 'tw:border-primary tw:bg-primary')} />,
    },
    { key: 'code', header: 'CODE', className: 'tw:font-medium' },
    { key: 'desc', header: 'DESCRIPTION' },
  ];
  const pickCategory = (category) => {
    setExportData((prev) => ({ ...prev, nfeiCategory: category.desc, nfeiCategoryCode: category.code, enterFilter: '' }));
    setIsCategoryModalOpen(false);
  };

  return (
    <Modal open={isCategoryModalOpen} title="Select NFEI Category" width={480} onClose={() => setIsCategoryModalOpen(false)}>
      <Field label="Search by">
        <Tabs value={searchBy} onValueChange={setField('catSearch')}>
          <TabsList variant="pill">
            <TabsTrigger value="CODE">Code</TabsTrigger>
            <TabsTrigger value="DESCRIPTION">Description</TabsTrigger>
          </TabsList>
        </Tabs>
      </Field>
      <Input name="enterFilter" placeholder="Type to filter..." value={exportData.enterFilter || ''} onChange={handleChange} />
      <DataTable columns={columns} rows={rows} rowKey="code" onRowClick={pickCategory} rowTitle="Click to select"
        containerClassName="tw:h-[320px] tw:rounded-sm tw:border tw:border-border" />
    </Modal>
  );
}

function FactoryAddressModal({ ctx }) {
  const { isFactoryAddressModalOpen, setIsFactoryAddressModalOpen, exportData, setField } = ctx;
  const close = () => setIsFactoryAddressModalOpen(false);
  const footer = (
    <>
      <Button variant="success" onClick={close}>OK</Button>
      <Button onClick={close}>CANCEL</Button>
    </>
  );
  return (
    <Modal open={isFactoryAddressModalOpen} title="Address" width={500} onClose={close} footer={footer} closeOnOutside={false}>
      <Field label="Address" layout="col">
        <Textarea rows={5} className="tw:resize-none" value={exportData.factoryAddress || ''} onChange={(event) => setField('factoryAddress')(event.target.value)} />
      </Field>
    </Modal>
  );
}

function MarksNoModal({ ctx }) {
  const { isMarksNoModalOpen, setIsMarksNoModalOpen, exportData, handleChange } = ctx;
  const close = () => setIsMarksNoModalOpen(false);
  return (
    <Modal open={isMarksNoModalOpen} title="MARKS & NUMBERS" width={600} onClose={close} footer={<Button variant="default" onClick={close}>OK</Button>}>
      <Field label="Marks & Numbers (Customs Flat File)" layout="col">
        <Textarea name="autoField_16" rows={6} placeholder="Enter Marks & Numbers here..." value={exportData.autoField_16 || ''} onChange={handleChange} />
      </Field>
      <Field label="Checklist Display Only (Not in Flat File)" layout="col">
        <Textarea name="thisDisplayOnlyInChecklistNotInCustomFlatFile" rows={6} placeholder="Additional Marks info for Checklist..."
          value={exportData.thisDisplayOnlyInChecklistNotInCustomFlatFile || ''} onChange={handleChange} />
      </Field>
    </Modal>
  );
}

export default function EtpMasterDetailsSection({ ctx }) {
  return (
    <>
      <EtpModal ctx={ctx} />
      <NfeiCategoryModal ctx={ctx} />
      <FactoryAddressModal ctx={ctx} />
      <MarksNoModal ctx={ctx} />
    </>
  );
}
