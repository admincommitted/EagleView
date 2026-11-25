import { Info, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Checkbox, DataTable, FileButton, NumberInput } from '@/components/ui';
import { AwbDrawer } from '../awbParts';
import { hasDimensionContent } from '../hooks/useDimensionLines';

const NUMBER_COLUMNS = [
  { key: 'pieces', header: 'Pieces' },
  { key: 'weight', header: 'Weight (kg)' },
  { key: 'length', header: 'Length (cm)' },
  { key: 'width', header: 'Width (cm)' },
  { key: 'height', header: 'Height (cm)' },
  { key: 'volume', header: 'Volume (cbm)', className: 'tw:font-bold', title: 'Filled automatically from L x W x H x pieces; type over it if the carrier measured differently' },
];
const FLAG_COLUMNS = [{ key: 'stackable', header: 'Stackable' }, { key: 'tiltable', header: 'Tiltable' }];

function dimensionColumns({ dims, removeDim, updateDim }) {
  const canRemove = dims.length > 1;
  return [
    {
      key: 'remove',
      header: '',
      width: '30px',
      align: 'center',
      cell: (dimension, index) => (
        <Button variant="ghost" size="icon-sm" aria-label="Remove line" aria-disabled={!canRemove} className={canRemove ? 'tw:text-destructive' : 'tw:cursor-not-allowed tw:text-border'} onClick={() => removeDim(index)}>
          <Trash2 />
        </Button>
      ),
    },
    ...NUMBER_COLUMNS.map((column) => ({
      key: column.key,
      header: column.header,
      cell: (dimension, index) => (
        <NumberInput align="right" value={dimension[column.key]} onValueChange={(text) => updateDim(index, column.key, text)} title={column.title} className={column.className} />
      ),
    })),
    ...FLAG_COLUMNS.map((column) => ({
      key: column.key,
      header: column.header,
      align: 'center',
      cell: (dimension, index) => <Checkbox checked={!!dimension[column.key]} onCheckedChange={(checked) => updateDim(index, column.key, checked === true)} />,
    })),
  ];
}

const Total = ({ label, children }) => (
  <div>
    <div className="tw:mb-1 tw:font-bold tw:text-primary">{label}</div>
    <div className="tw:text-sm tw:font-bold">{children}</div>
  </div>
);

export default function DimensionsDrawer({ ctx }) {
  const { showDimsModal, setShowDimsModal, dims, addDim, downloadDims, uploadDims, watch, totalPieces, totalWeight, totalVolume, volWeight, chargeableWeight } = ctx;
  const close = () => setShowDimsModal(false);
  const finish = () => {
    const kept = dims.filter(hasDimensionContent).length;
    toast.success(kept ? kept + ' dimension line(s) kept - they go with the AWB when you save it' : 'No dimension line filled in');
    close();
  };

  return (
    <AwbDrawer open={showDimsModal} title="Add Dimensions" onClose={close} className="tw:sm:w-[850px] tw:sm:max-w-full">
      <div className="tw:mb-6 tw:flex tw:flex-wrap tw:justify-between tw:gap-4 tw:text-xs">
        <Total label="Total Pieces">{totalPieces || '--'}</Total>
        <Total label="Total Weight">{totalWeight || '--'} kg</Total>
        <Total label="Total Volume">{totalVolume ? totalVolume.toFixed(3) : '--'} cbm</Total>
        <Total label="Volumetric Weight">{volWeight > 0 ? volWeight : '--'} kg</Total>
        <Total label="Chargeable Weight">{chargeableWeight > 0 ? chargeableWeight : '--'} kg</Total>
      </div>

      <div className="tw:mb-4 tw:flex tw:flex-col tw:items-start tw:justify-between tw:gap-2 tw:md:flex-row">
        <div>
          <div className="tw:mb-1 tw:text-[13px] tw:font-bold">Add your piece group level dimensions below</div>
          <div className="tw:flex tw:items-center tw:gap-1 tw:text-[11px] tw:text-destructive">
            <Info className="tw:size-3" /> Volume is worked out from L x W x H x pieces; type over it if the carrier measured differently
          </div>
        </div>
        <div className="tw:flex tw:items-center tw:gap-2">
          <Button variant="link" className="tw:text-[13px] tw:text-destructive" onClick={() => downloadDims(watch('awbNumber'))}>Download Dims</Button>
          <FileButton accept=".xlsx,.xls,.csv,.txt" onFiles={(files) => uploadDims(files[0])}>Upload Bulk Dims</FileButton>
        </div>
      </div>

      <div className="tw:mb-2 tw:text-right">
        <Button variant="destructive" className="tw:mr-2 tw:font-bold" onClick={addDim}>+ Add Row</Button>
      </div>

      <DataTable
        columns={dimensionColumns(ctx)}
        rows={dims}
        rowKey={(dimension, index) => index}
        emptyText={'No dimension line yet - use "+ Add Row" or upload a file.'}
        containerClassName="tw:mb-6"
      />

      <div className="tw:flex tw:gap-3">
        <Button size="lg" className="tw:border-destructive tw:bg-destructive tw:font-bold tw:text-white" onClick={finish}>Done</Button>
        <Button size="lg" variant="destructive" className="tw:font-bold" onClick={close}>Cancel</Button>
      </div>
    </AwbDrawer>
  );
}
