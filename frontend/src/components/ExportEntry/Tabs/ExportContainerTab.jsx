import { PlusCircle, Trash2 } from 'lucide-react';
import { Button, DataTable, DateInput, Input, Section, SelectBox } from '@/components/ui';
import { useExportContext } from '../ExportContext';

const CONTAINER_SIZES = ['20', '40', '45'];

export default function ExportContainerTab() {
  const { containers, setContainers } = useExportContext();

  const addContainer = () => {
    const newId = containers.length ? Math.max(...containers.map((container) => container.id || 0)) + 1 : 1;
    setContainers([...containers, { id: newId, containerNo: '', size: '20', exciseSealNo: '', sealDate: '', deviceId: '' }]);
  };

  const updateContainer = (id, field, value) => {
    setContainers(containers.map((container) => (container.id === id ? { ...container, [field]: value } : container)));
  };

  const removeContainer = (id) => {
    setContainers(containers.filter((container) => container.id !== id));
  };

  const textCell = (field, placeholder) => (container) => (
    <Input
      data-allow-text
      placeholder={placeholder}
      value={container[field] || ''}
      onChange={(event) => updateContainer(container.id, field, event.target.value.toUpperCase())}
    />
  );

  const columns = [
    { key: 'containerNo', header: 'Container No', cell: textCell('containerNo') },
    {
      key: 'size',
      header: 'Size',
      cell: (container) => (
        <SelectBox className="tw:w-20" options={CONTAINER_SIZES} value={container.size || '20'} onValueChange={(size) => updateContainer(container.id, 'size', size)} />
      ),
    },
    { key: 'exciseSealNo', header: 'Excise Seal No', cell: textCell('exciseSealNo', 'Seal No') },
    {
      key: 'sealDate',
      header: 'Seal Date',
      cell: (container) => <DateInput value={container.sealDate || ''} onValueChange={(date) => updateContainer(container.id, 'sealDate', date)} />,
    },
    { key: 'deviceId', header: 'Device ID', cell: textCell('deviceId', 'RFID/Device ID') },
    {
      key: 'actions',
      header: 'Act',
      align: 'center',
      width: '40px',
      cell: (container) => (
        <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Remove container" onClick={() => removeContainer(container.id)}>
          <Trash2 />
        </Button>
      ),
    },
  ];

  return (
    <div className="glass-panel tw:flex tw:h-full tw:flex-col tw:gap-4 tw:overflow-y-auto tw:p-4">
      <Section
        title="Container Details"
        actions={<Button variant="secondary" onClick={addContainer}><PlusCircle /> Add Container</Button>}
      >
        <DataTable
          columns={columns}
          rows={containers}
          rowKey={(container, index) => container.id || index}
          emptyText='No containers added. Click "Add Container" to start.'
        />
      </Section>
    </div>
  );
}
