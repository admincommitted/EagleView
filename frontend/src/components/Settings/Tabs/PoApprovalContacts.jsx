import { useEffect, useState } from 'react';
import { Loader2, Save, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui';
import { settingsApi } from '../settingsApi';
import { CornerToast } from './SettingsParts/Notices';
import { SettingsCard } from './SettingsParts/SettingsCard';
import { SettingsFields } from './SettingsParts/SettingsFields';
import { useTimedNotice } from './SettingsParts/useTimedNotice';

// Saved as App Settings PO_DIRECTOR_EMAIL / PO_DIRECTOR_PHONE / PO_APPROVAL_LINK_BASE (read by routes/poRoutes.js).
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const LINK_BASE_PATTERN = /^https?:\/\/[^\s/]+(:\d+)?$/;
const TOAST_MS = 4500;

const contactFields = (modulePhone) => [
  { name: 'email', label: 'Director e-mail id(s)', placeholder: 'director@committedcargo.com', note: 'More than one: separate with a comma.', className: 'tw:md:col-span-2' },
  {
    name: 'phone', label: 'Director WhatsApp number', placeholder: modulePhone || '98XXXXXXXX',
    note: modulePhone ? `Blank = ${modulePhone} ("Purchase" number in Settings > WhatsApp).` : 'Sent through the WhatsApp connected in Settings > WhatsApp.',
  },
  {
    name: 'linkBase', label: 'Approval link address (optional)', placeholder: "Blank = this PC's network address, e.g. http://192.168.1.20:5001", className: 'tw:md:col-span-3',
    note: 'The Approve / Reject links open this address. Blank works inside the office network; give a public address only if the director approves from outside.',
  },
].map((field) => ({ ...field, controlClassName: 'tw:normal-case' }));

export default function PoApprovalContacts() {
  const [contacts, setContacts] = useState({ email: '', phone: '', linkBase: '' });
  const [modulePhone, setModulePhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, showNotice] = useTimedNotice(TOAST_MS);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const settings = (await settingsApi.settings()) || {};
        setContacts({ email: settings.PO_DIRECTOR_EMAIL || '', phone: settings.PO_DIRECTOR_PHONE || '', linkBase: settings.PO_APPROVAL_LINK_BASE || '' });
      } catch {
        // the boxes stay empty
      }
    };
    const loadPurchaseNumber = async () => {
      try {
        const purchase = ((await settingsApi.whatsappModuleNumbers()) || []).find((module) => /purchase/i.test(module.moduleName || ''));
        if (purchase) setModulePhone(purchase.phoneNumber);
      } catch {
        // no default number shown
      }
    };
    loadContacts();
    loadPurchaseNumber();
  }, []);

  const changeField = (name, value) => setContacts((current) => ({ ...current, [name]: value }));

  const save = async () => {
    const emails = contacts.email.split(/[,;]/).map((email) => email.trim()).filter(Boolean);
    const badEmails = emails.filter((email) => !EMAIL_PATTERN.test(email));
    if (!emails.length) { showNotice("Enter the director's e-mail id", 'error'); return; }
    if (badEmails.length) { showNotice(`Not an e-mail id: ${badEmails.join(', ')}`, 'error'); return; }
    const digits = contacts.phone.replace(/\D/g, '');
    if (contacts.phone.trim() && (digits.length < 10 || digits.length > 15)) { showNotice('WhatsApp number: 10 digits, or with country code', 'error'); return; }
    const linkBase = contacts.linkBase.trim().replace(/\/+$/, '');
    if (linkBase && !LINK_BASE_PATTERN.test(linkBase)) { showNotice('Link address like http://192.168.1.20:5001', 'error'); return; }
    setSaving(true);
    try {
      await settingsApi.saveSettings({ PO_DIRECTOR_EMAIL: emails.join(', '), PO_DIRECTOR_PHONE: contacts.phone.trim(), PO_APPROVAL_LINK_BASE: linkBase });
      setContacts((current) => ({ ...current, email: emails.join(', '), linkBase }));
      showNotice('Purchase Order approval contacts saved ✅');
    } catch (error) {
      showNotice(error.response?.data?.error || 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard icon={ShoppingCart} title="Purchase Order approval"
      description="Who gets the approval request (with Approve / Reject / Hold links) when a PO is sent for approval."
      footer={(
        <Button variant="default" size="lg" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="tw:animate-spin" /> : <Save />}{saving ? 'Saving...' : 'Save PO approval contacts'}
        </Button>
      )}>
      <CornerToast notice={notice} />
      <SettingsFields fields={contactFields(modulePhone)} values={contacts} onChange={changeField} className="tw:md:grid-cols-3" />
    </SettingsCard>
  );
}
