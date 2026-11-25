import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, RefreshCw, Save, Search, Trash2, Users } from 'lucide-react';
import { askConfirm } from '../components/common/askConfirm';
import { Button, DataTable, Input, Section } from '@/components/ui';
import { purchaseApi } from './PurchaseParts/purchaseApi';
import FormFields from './PurchaseParts/FormFields';
import PageHeader from './PurchaseParts/PageHeader';
import { BLANK_VENDOR, serverError, VENDOR_FIELDS, vendorForm } from './PurchaseParts/vendorFields';

const SEARCHED_KEYS = ['vendorName', 'gstNumber', 'contactEmail', 'phone', 'address'];

function vendorColumns({ onEdit, onDelete }) {
  return [
    { key: 'srNo', header: 'Sr No', align: 'right', width: 46, cell: (vendor, index) => index + 1 },
    {
      key: 'edit', header: 'Edit', align: 'center', width: 40,
      cell: (vendor) => <Button variant="ghost" size="icon-sm" title={`Edit ${vendor.vendorName}`} onClick={() => onEdit(vendor)}><Pencil /></Button>,
    },
    {
      key: 'delete', header: 'Delete', align: 'center', width: 50,
      cell: (vendor) => <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title={`Delete ${vendor.vendorName}`} onClick={() => onDelete(vendor)}><Trash2 /></Button>,
    },
    { key: 'vendorName', header: 'Vendor Name', cell: (vendor) => <b>{vendor.vendorName}</b> },
    { key: 'gstNumber', header: 'GST', cell: (vendor) => vendor.gstNumber || '-' },
    { key: 'contactEmail', header: 'Email', className: 'tw:normal-case', cell: (vendor) => (vendor.contactEmail ? String(vendor.contactEmail).toLowerCase() : '-') },
    { key: 'phone', header: 'Phone', cell: (vendor) => vendor.phone || '-' },
    { key: 'address', header: 'Address', className: 'tw:whitespace-normal', cell: (vendor) => vendor.address || '-' },
  ];
}

export default function VendorMaster() {
  const [vendors, setVendors] = useState([]);
  const [formData, setFormData] = useState(BLANK_VENDOR);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const nameBox = useRef(null);

  const loadVendors = async () => {
    try {
      const list = await purchaseApi.vendors();
      setVendors(Array.isArray(list) ? list : []);
    } catch (error) {
      toast.error(serverError(error, 'The vendor list could not be read'));
    }
  };
  useEffect(() => { loadVendors(); }, []);

  const changeField = (name, value) => setFormData((current) => ({ ...current, [name]: value }));
  const clearForm = () => { setFormData(BLANK_VENDOR); setEditId(null); nameBox.current?.focus(); };

  const saveVendor = async (event) => {
    event.preventDefault();
    if (!formData.vendorName.trim()) { toast.error('Vendor name is required'); return; }
    setSaving(true);
    try {
      if (editId) await purchaseApi.updateVendor(editId, formData);
      else await purchaseApi.addVendor(formData);
      toast.success(editId ? 'Vendor updated' : 'Vendor added');
      clearForm();
      loadVendors();
    } catch (error) {
      toast.error(serverError(error, editId ? 'The vendor could not be updated' : 'The vendor could not be added'));
    }
    setSaving(false);
  };

  const startEdit = (vendor) => {
    setEditId(vendor.id);
    setFormData(vendorForm(vendor));
    nameBox.current?.focus();
  };

  const deleteVendor = async (vendor) => {
    const confirmed = await askConfirm({
      title: 'Delete vendor',
      message: `Delete ${vendor.vendorName} from the vendor master?`,
      note: 'This cannot be undone. A vendor used in a purchase order is not deleted.',
      okLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await purchaseApi.deleteVendor(vendor.id);
      toast.success('Vendor deleted');
      if (editId === vendor.id) clearForm();
      loadVendors();
    } catch (error) {
      toast.error(serverError(error, 'The vendor could not be deleted'), { duration: 6000 });
    }
  };

  const shownVendors = useMemo(() => {
    const query = searchText.trim().toUpperCase();
    const sorted = [...vendors].sort((first, second) => String(first.vendorName || '').localeCompare(String(second.vendorName || '')));
    if (!query) return sorted;
    return sorted.filter((vendor) => SEARCHED_KEYS.some((key) => String(vendor[key] || '').toUpperCase().includes(query)));
  }, [vendors, searchText]);

  const countText = shownVendors.length !== vendors.length ? `${shownVendors.length} of ${vendors.length}` : shownVendors.length;

  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:px-3 tw:py-1.5">
      <PageHeader icon={Users} title="Vendor Master" subtitle="Suppliers and vendors for purchase orders" />

      <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-4 tw:lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <Section title={editId ? 'Edit vendor' : 'Add new vendor'}>
          <form onSubmit={saveVendor} className="tw:flex tw:flex-col tw:gap-2">
            <FormFields fields={VENDOR_FIELDS} values={formData} onChange={changeField} layout="row" labelWidth="96px"
              inputRefs={{ vendorName: nameBox }} className="tw:gap-1" />
            <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-1.5">
              <Button onClick={clearForm}><RefreshCw /> {editId ? 'Cancel edit' : 'Clear'}</Button>
              <Button type="submit" variant="default" disabled={saving}><Save /> {saving ? 'Saving...' : editId ? 'Update vendor' : 'Save vendor'}</Button>
            </div>
          </form>
        </Section>

        <Section
          title={`Vendor directory (${countText})`}
          actions={(
            <Input leftIcon={Search} className="tw:w-full tw:sm:w-[220px]" data-allow-text="" placeholder="Search name, GST, phone..."
              value={searchText} onChange={(event) => setSearchText(event.target.value)} />
          )}
        >
          <DataTable
            columns={vendorColumns({ onEdit: startEdit, onDelete: deleteVendor })}
            rows={shownVendors}
            selectedKey={editId}
            onRowDoubleClick={startEdit}
            rowTitle="Double-click to edit"
            emptyText={vendors.length ? 'No vendor matches the search.' : 'No vendor yet - add one at the left.'}
            containerClassName="tw:max-h-[calc(100vh-230px)]"
          />
        </Section>
      </div>
    </div>
  );
}
