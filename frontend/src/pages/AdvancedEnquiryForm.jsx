import { useEffect, useState } from 'react';
import { IndianRupee, MapPin, Save, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Modal, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { salesCrmApi } from './SalesParts/salesApi';
import { ClientTab, CommercialsTab, RoutingTab } from './SalesCrmParts/EnquiryFormTabs';
import SaveErrors from './SalesCrmParts/SaveErrors';
import { showSaveFailure } from './SalesCrmParts/saveFailure';

const MODES = ['Sea', 'Air', 'Land'];
const FORM_TABS = [
  { value: 'client', label: 'Client Details', icon: UserPlus },
  { value: 'routing', label: 'Routing & Cargo', icon: MapPin },
  { value: 'commercials', label: 'Commercials', icon: IndianRupee },
];

const EMPTY_ENQUIRY = {
  enquiryNo: '',
  partyLedgerId: '',
  designation: '',
  readinessDate: '',
  clientName: '',
  contactPerson: '',
  email: '',
  phone: '',
  origin: '',
  destination: '',
  incoterms: 'FOB',
  commodity: '',
  containerType: '20GP',
  weight: '',
  volume: '',
  targetRate: '',
  competitor: '',
  remarks: '',
};

export default function AdvancedEnquiryForm({ onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState('client');
  const [mode, setMode] = useState('Sea');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [parties, setParties] = useState([]);
  const [form, setForm] = useState(() => ({ ...EMPTY_ENQUIRY, date: new Date().toISOString().split('T')[0] }));

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  useEffect(() => {
    const loadLists = async () => {
      // the server fills the number in when this fails
      const [nextNo, ledgers] = await Promise.allSettled([salesCrmApi.nextLeadNo(), salesCrmApi.debtorLedgers()]);
      if (nextNo.status === 'fulfilled' && nextNo.value.enquiryNo) setField('enquiryNo', nextNo.value.enquiryNo);
      setParties(ledgers.status === 'fulfilled' ? ledgers.value.data || [] : []);
    };
    loadLists();
  }, []);

  const pickParty = (id) => {
    const party = parties.find((candidate) => String(candidate.id) === String(id));
    setForm((current) => ({
      ...current,
      partyLedgerId: id,
      clientName: party ? party.name : current.clientName,
      email: party?.email || current.email,
      phone: party?.phone || current.phone,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const { data: saved } = await salesCrmApi.createLead({ ...form, mode, partyLedgerId: form.partyLedgerId || null });
      toast.success(`Enquiry ${saved.enquiryNo} saved`);
      if (onSaved) onSaved(saved); else onClose();
    } catch (error) {
      showSaveFailure(error, setErrors);
    }
    setSaving(false);
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={900}
      closeOnOutside={false}
      className="tw:md:h-[85vh]"
      title={<span className="tw:flex tw:items-center tw:gap-2"><UserPlus className="tw:size-5 tw:text-primary" /> Logistics CRM - New Sales Enquiry</span>}
      description="Capture Lead, Routing, and Target Pricing details"
      footer={(
        <div className="tw:flex tw:w-full tw:flex-col tw:gap-3">
          <SaveErrors errors={errors} />
          <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-3">
            <Button size="lg" onClick={onClose}>Cancel</Button>
            <Button variant="default" size="lg" onClick={handleSave} disabled={saving}>
              <Save /> {saving ? 'Saving...' : 'Save Enquiry'}
            </Button>
          </div>
        </div>
      )}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="tw:gap-6">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-end tw:sm:justify-between">
          <TabsList className="tw:flex-wrap">
            {FORM_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value}><Icon /> {label}</TabsTrigger>
            ))}
          </TabsList>
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList variant="pill">
              {MODES.map((name) => <TabsTrigger key={name} value={name} className="tw:font-bold">{name}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>
        <TabsContent value="client">
          <ClientTab form={form} setField={setField} parties={parties} onPickParty={pickParty} />
        </TabsContent>
        <TabsContent value="routing">
          <RoutingTab form={form} setField={setField} mode={mode} />
        </TabsContent>
        <TabsContent value="commercials">
          <CommercialsTab form={form} setField={setField} />
        </TabsContent>
      </Tabs>
    </Modal>
  );
}
