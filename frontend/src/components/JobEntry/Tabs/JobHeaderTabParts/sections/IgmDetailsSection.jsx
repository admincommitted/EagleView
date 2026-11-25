import { useState } from 'react';
import { Download, Edit, PlusSquare, RefreshCw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, ComboInput, DataTable, DateInput, Field, Input, NumberInput, Section } from '@/components/ui';
import IcegateIgmModal from './IcegateIgmModal';
import { dateColumn } from './igmDisplay';
import { editColumn, removeColumn } from './rowActionColumns';

const LABEL_WIDTH = '75px';
const FIELD_ROW = 'tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2 tw:lg:flex tw:lg:items-center tw:lg:gap-4';

const PACKAGE_CODES = [
  ['BDL', 'BUNDLE'], ['BLO', 'STEEL BLOCKS'], ['BLS', 'BAILS'], ['BOU', 'BILLIONS OF UNIT'], ['BOX', 'BOXES'], ['BRL', 'BARREL'],
  ['BUL', 'STEEL BULKS'], ['CAS', 'CASES'], ['CBY', 'CARBOYS'], ['CHT', 'CHEST'], ['CLS', 'COILS'], ['COL', 'COLLIES'],
  ['CON', 'CONTAINER'], ['CRT', 'CRATES'], ['CSK', 'WOODEN CASKS'], ['CTN', 'CARTONS'], ['DRM', 'DRUMS'], ['ENV', 'STEEL ENVELOPES'],
  ['FLK', 'FLASK'], ['HBK', 'HABBUCK'], ['JBL', 'JUMBLE BALE'], ['JTA', 'JOTTA'], ['KEG', 'KEGGS'], ['NGT', 'INGOT'],
  ['PAL', 'PALLS'], ['PCS', 'PIECES'], ['PKG', 'PACKAGES'], ['PLT', 'PALLETS'], ['QDS', 'QUADS'], ['REL', 'REELS'],
  ['RLS', 'ROOLS'], ['SHT', 'SHEETS'], ['SKD', 'SKID & SKIDDED PKGS'], ['SLB', 'SLABS'], ['TBL', 'TABLE'], ['TRK', 'TRUNK'],
  ['UNT', 'UNITS'], ['VLS', 'VIALS'],
].map(([value, label]) => ({ value, label }));

const REFERENCE_FIELDS = [
  { name: 'igmNumber', fallback: 'igmNo', label: 'IGM No', placeholder: 'IGM NO' },
  { name: 'igmDate', fallback: 'autoField_14', label: 'IGM Date', date: true },
  { name: 'mawbNo', fallback: 'mawbblNo', label: 'MAWB No.', nonAirLabel: 'BL No.', placeholder: 'MAWB/BL NO' },
  { name: 'mawbDate', fallback: 'autoField_15', label: 'MAWB Date', nonAirLabel: 'BL Date', date: true },
  { name: 'hawbNo', fallback: 'hawbhblNo', label: 'HAWB No.', nonAirLabel: 'HBL No.', placeholder: 'HAWB/HBL NO' },
  { name: 'hawbDate', fallback: 'autoField_16', label: 'HAWB Date', nonAirLabel: 'HBL Date', date: true },
];

const IGM_GRID_COLUMNS = [
  { key: 'igmNumber', header: 'Igm No.', cell: (row) => row.igmNumber || row.igmNo },
  dateColumn('igmDate', 'Igm Dt.'),
  { key: 'mawbNo', header: 'Mawb No.' },
  dateColumn('mawbDate', 'Mawb Dt.'),
  { key: 'track', header: 'Track', width: 50, cell: () => null },
  { key: 'hawbNo', header: 'Hawb No.' },
  dateColumn('hawbDate', 'Hawb Dt.'),
  dateColumn('inwardDate', 'Inward Dt.'),
  { key: 'totalPkg', header: 'Total Pkg.' },
  { key: 'pkgCode', header: 'Pkg. Code' },
  { key: 'grossWt', header: 'Gross Wt.' },
  { key: 'wtUnit', header: 'Unit Code' },
  { key: 'marks1', header: 'Marks & No.1' },
  { key: 'lineNo', header: 'Line No.' },
];

function JobField({ jobData, onChange, name, fallback, label, title, date, placeholder, required, labelWidth = LABEL_WIDTH, className = 'tw:flex-1' }) {
  const box = { name, required, value: jobData[name] || jobData[fallback] || '', onChange };
  return (
    <Field label={title ? <span title={title}>{label}</span> : label} required={required} labelWidth={labelWidth} className={className}>
      {date ? <DateInput {...box} /> : <Input {...box} placeholder={placeholder} />}
    </Field>
  );
}

function SaveButtons({ jobData, handleHeaderSave, handleClearForm }) {
  const savedJob = Boolean(jobData.id);
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-2 tw:rounded-sm tw:border tw:border-border tw:px-4 tw:py-3">
      <Button variant="success" size="lg" title={savedJob ? 'Save the changes to job ' + (jobData.jobNo || '') : 'Save as a new job'} onClick={() => handleHeaderSave('save')}>
        <Save /> Save
      </Button>
      <span title={savedJob ? 'Update job ' + (jobData.jobNo || '') : 'Open a saved job (1. Job Query) to modify it'}>
        <Button variant="success" size="lg" disabled={!savedJob} onClick={() => handleHeaderSave('modify')}><Edit /> Modify</Button>
      </span>
      <Button size="lg" onClick={handleClearForm}><RefreshCw /> Clear</Button>
    </div>
  );
}

export default function IgmDetailsSection({ ctx }) {
  const {
    handleHeaderSave, handleClearForm, handleAddIgmRow, handleChange, handleClearIgmRow, handleEditIgmRow, handlePortSelect, handleRemoveIgmRow,
    igmEditIdx, igmRows, jobData, masters, ports, setIsContainerModalOpen, setJobData, transportMode,
  } = ctx;
  const [icegateOpen, setIcegateOpen] = useState(false);
  const air = transportMode === 'A';
  // an Ex-Bond BE carries no IGM / MAWB / HAWB, and its packages / weight are the quantity released by this ex-bond
  const isExBond = String(ctx.beType || '').toUpperCase() === 'X';
  const igmRequired = !isExBond;
  const setJobKey = (key) => (value) => setJobData((previous) => ({ ...previous, [key]: value }));
  const fieldProps = { jobData, onChange: handleChange };

  const fillFromIcegate = (line) => {
    if (!line) return;
    setJobData((previous) => ({
      ...previous,
      igmNumber: line.igmNo || previous.igmNumber || '', igmNo: line.igmNo || previous.igmNo || '',
      ...(line.igmDate ? { igmDate: line.igmDate, autoField_14: line.igmDate } : {}),
      ...(line.inwardDate ? { inwardDate: line.inwardDate, autoField_17: line.inwardDate } : {}),
      mawbNo: line.mawbNo || previous.mawbNo || '',
      ...(line.kind === 'HAWB' && line.hawbNo ? { hawbNo: line.hawbNo } : {}),
      ...(line.mawbDate ? { mawbDate: line.mawbDate, autoField_15: line.mawbDate } : {}),
      ...(line.kind === 'HAWB' && line.hawbDate ? { hawbDate: line.hawbDate, autoField_16: line.hawbDate } : {}),
      ...(line.pkgCode ? { pkg: line.pkgCode } : {}),
      ...(line.lineNo ? { lineNo: line.lineNo } : {}),
      ...(line.totalPkg ? { totalPkg: line.totalPkg } : {}),
      ...(line.grossWt ? { grossWt: line.grossWt, grossWtUnit: line.wtUnit || previous.grossWtUnit || 'KGS' } : {}),
    }));
    setIcegateOpen(false);
    toast.success('IGM details filled from ICEGATE (' + (line.kind === 'HAWB' ? 'house ' + line.hawbNo : (transportMode === 'S' ? 'BL line' : 'MAWB line')) + '). Check them, then press Add.');
  };

  const gridColumns = [editColumn(handleEditIgmRow), removeColumn(handleRemoveIgmRow), ...IGM_GRID_COLUMNS];

  return (
    <>
      <Section title="IGM Details" className="tw:rounded-sm tw:border tw:border-border tw:p-2">
        <div className={FIELD_ROW}>
          {REFERENCE_FIELDS.map((field) => (
            <JobField key={field.name} {...fieldProps} {...field} label={air ? field.label : field.nonAirLabel || field.label} required={igmRequired} />
          ))}
        </div>

        <div className={FIELD_ROW}>
          <JobField {...fieldProps} name="inwardDate" fallback="autoField_17" label="Inward Date" date required={igmRequired} />
          <Field label={<span title={isExBond ? 'Packages released from the warehouse by this Ex-Bond' : undefined}>{isExBond ? 'Pkg Released' : 'Total Pkg'}</span>} required labelWidth={LABEL_WIDTH} className="tw:flex-1">
            <NumberInput name="totalPkg" required placeholder="TOTAL PKG" value={jobData.totalPkg || ''} onValueChange={setJobKey('totalPkg')} />
          </Field>
          <Field label="Pkg Code" required labelWidth={LABEL_WIDTH} className="tw:flex-1">
            <ComboInput name="pkg" required placeholder="PKG" options={PACKAGE_CODES} value={jobData.pkg || ''} onValueChange={setJobKey('pkg')} />
          </Field>
          <Field label={<span title={isExBond ? 'Gross weight released from the warehouse by this Ex-Bond' : undefined}>{isExBond ? 'Wt Released' : 'Gross Wt.'}</span>} required labelWidth={LABEL_WIDTH} className="tw:flex-1">
            <NumberInput name="grossWt" required placeholder="GROSS WT" value={jobData.grossWt || ''} onValueChange={setJobKey('grossWt')} />
          </Field>
          <Field label="Wt. Unit" required labelWidth={LABEL_WIDTH} className="tw:flex-1">
            <ComboInput name="grossWtUnit" required placeholder="KGS" options={masters?.uqcs || []} getValue={(uqc) => uqc.uqcCode} getLabel={(uqc) => uqc.description}
              value={jobData.grossWtUnit || ''} onValueChange={setJobKey('grossWtUnit')} />
          </Field>
          <JobField {...fieldProps} name="autoField_18" label="Bulk shipment" labelWidth="90px" />
        </div>

        <div className={FIELD_ROW}>
          <JobField {...fieldProps} name="marksAndNumbers1" fallback="marks1" label="Marks & No." placeholder="MARKS & NO" required={igmRequired} className="tw:lg:flex-[2]" />
          <JobField {...fieldProps} name="lineNo" label="Line No" placeholder="LINE NO" />
          <span className="tw:hidden tw:lg:block tw:lg:flex-[3]" />
        </div>

        {transportMode === 'S' && (
          <Section title="ICD Specification" className="tw:my-1 tw:rounded-sm tw:border tw:border-border tw:p-2">
            <div className={FIELD_ROW}>
              <JobField {...fieldProps} name="gatewayIgmNo" label="Gateway IGM No." placeholder="NO." labelWidth="110px" />
              <JobField {...fieldProps} name="gatewayIgmDate" fallback="autoField_19" label="Gateway IGM Date" date labelWidth="120px" />
              <Field label="Reporting Port" required labelWidth="90px" className="tw:lg:flex-[1.5]">
                <ComboInput name="portName" required placeholder="PORT NAME" className="tw:flex-[2]" options={ports}
                  getValue={(port) => port.portName} getLabel={(port) => port.portCode}
                  value={jobData.gatewayPortName || jobData.portName || ''} onValueChange={(value) => handlePortSelect({ target: { name: 'portName', value } })} />
                <ComboInput name="gatewayPortCode" placeholder="CODE" options={ports} getValue={(port) => port.portCode} getLabel={(port) => port.portName}
                  value={jobData.gatewayPortCode || jobData.code || ''} onValueChange={(value) => handleChange({ target: { name: 'gatewayPortCode', value } })} />
              </Field>
              <div className="tw:flex tw:items-center tw:lg:flex-[0.5]">
                <Button size="sm" onClick={() => setIsContainerModalOpen(true)}>Container</Button>
              </div>
            </div>
          </Section>
        )}

        <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2 tw:pr-2">
          {(air || transportMode === 'S') && (
            <Button variant="default" title="Reads ICEGATE's public IGM enquiry for this MAWB / BL and fills the IGM boxes" onClick={() => setIcegateOpen(true)}>
              <Download /> Fetch from ICEGATE
            </Button>
          )}
          <Button variant="default" onClick={handleAddIgmRow}><PlusSquare /> {igmEditIdx !== null ? 'Update' : 'Add'}</Button>
          <Button variant="secondary" onClick={handleClearIgmRow}><RefreshCw /> Clear</Button>
        </div>

        <DataTable columns={gridColumns} rows={igmRows} rowKey={(_, index) => index} selectedKey={igmEditIdx}
          emptyText="No IGM rows - fill the IGM details and click Add" containerClassName="tw:border-t tw:border-border" />
      </Section>

      <SaveButtons jobData={jobData} handleHeaderSave={handleHeaderSave} handleClearForm={handleClearForm} />

      <IcegateIgmModal open={icegateOpen} onClose={() => setIcegateOpen(false)} mode={transportMode}
        location={(transportMode === 'S' && jobData.gatewayPortCode) || jobData.portCode || jobData.autoField_2 || ''}
        mawb={jobData.mawbNo || jobData.mawbblNo || ''} hawb={jobData.hawbNo || jobData.hawbhblNo || ''} onFill={fillFromIcegate} />
    </>
  );
}
