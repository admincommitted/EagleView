import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Modal, Section, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { fleetApi, fleetMastersOrEmpty } from './PurchaseParts/fleetApi';
import FormFields from './PurchaseParts/FormFields';
import Notice from './PurchaseParts/Notice';
import { blankLorryReceipt, freightOf, freightWarnings, lorryReceiptTabs, lorryReceiptToSave } from './PurchaseParts/lorryReceiptForm';

function FormSection({ section, values, onChange }) {
  const fields = <FormFields fields={section.fields} values={values} onChange={onChange} className={`tw:gap-4 ${section.grid}`} />;
  if (section.tone) {
    return <Notice tone={section.tone} title={section.title}><span className="tw:text-[11px]">{section.note}</span>{fields}</Notice>;
  }
  if (!section.title) return fields;
  return <Section title={section.title}>{fields}</Section>;
}

function SaveErrors({ errors }) {
  return (
    <Notice tone="danger" title="Nothing was saved. Fix these first:">
      <ul className="tw:m-0 tw:pl-5">
        {errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
      </ul>
    </Notice>
  );
}

export default function AdvancedLRForm({ onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState('routing');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [masters, setMasters] = useState({ transporters: [], ledgers: [], paymentVoucherTypes: [] });
  const [form, setForm] = useState(blankLorryReceipt);

  useEffect(() => {
    const loadNextLrNo = async () => {
      try {
        const next = await fleetApi.nextLrNo();
        if (next.lrNo) setForm((current) => ({ ...current, lrNo: next.lrNo }));
      } catch {
        // the server gives the LR its number when it is saved
      }
    };
    const loadMasters = async () => {
      const fleetMasters = await fleetMastersOrEmpty();
      setMasters({ transporters: fleetMasters.transporters || [], ledgers: fleetMasters.ledgers || [], paymentVoucherTypes: fleetMasters.paymentVoucherTypes || [] });
    };
    loadNextLrNo();
    loadMasters();
  }, []);

  const changeField = (name, value) => {
    if (name === 'transporterId') {
      const transporter = masters.transporters.find((entry) => String(entry.id) === String(value));
      setForm((current) => ({ ...current, transporterId: value, vehicleType: transporter?.vehicleType || current.vehicleType }));
      return;
    }
    setForm((current) => ({ ...current, [name]: value }));
  };

  const freight = freightOf(form);
  const values = { ...form, freightTotal: freight ? freight.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '' };
  const tabs = lorryReceiptTabs({ masters, warnings: freightWarnings(form, freight) });

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const reply = await fleetApi.saveLorryReceipt(lorryReceiptToSave(form));
      toast.success(`Lorry receipt ${reply.data.lrNo} saved`);
      if (onSaved) onSaved(reply.data);
      else if (onClose) onClose();
    } catch (error) {
      const refusal = error.response?.data;
      if (refusal) {
        setErrors(refusal.errors || [errorMessage(error)]);
        toast.error('Not saved - see the messages on the form');
      } else {
        setErrors([error.message]);
        toast.error(`Not saved: ${error.message}`);
      }
    }
    setSaving(false);
  };

  return (
    <Modal
      open
      width={950}
      closeOnOutside={false}
      title="Fleet & TMS - New Lorry Receipt (LR) & Trip Entry"
      description="Advanced Dispatch, Freight, and E-Way Bill Tracking"
      onClose={onClose}
      bodyClassName="tw:flex tw:flex-col tw:gap-4"
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="warning" disabled={saving} onClick={save}><Save /> {saving ? 'Saving...' : 'Save Lorry Receipt'}</Button>
        </>
      )}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="tw:h-auto tw:flex-wrap">
          {tabs.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value}><Icon /> {label}</TabsTrigger>)}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="tw:flex tw:min-h-[50vh] tw:flex-col tw:gap-6 tw:pt-5">
            {tab.sections.map((section, index) => <FormSection key={section.title || index} section={section} values={values} onChange={changeField} />)}
          </TabsContent>
        ))}
      </Tabs>
      {errors.length > 0 && <SaveErrors errors={errors} />}
    </Modal>
  );
}
