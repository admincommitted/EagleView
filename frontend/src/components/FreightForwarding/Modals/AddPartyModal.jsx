import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Field, Input, Modal, Section, Textarea } from '@/components/ui';
import { freightApi } from '../freightApi';

const COUNTRY_CODES = {
  AFGHANISTAN: 'AF', ALBANIA: 'AL', ALGERIA: 'DZ', ANDORRA: 'AD', ANGOLA: 'AO', ARGENTINA: 'AR', ARMENIA: 'AM', AUSTRALIA: 'AU', AUSTRIA: 'AT', AZERBAIJAN: 'AZ',
  BAHAMAS: 'BS', BAHRAIN: 'BH', BANGLADESH: 'BD', BARBADOS: 'BB', BELARUS: 'BY', BELGIUM: 'BE', BELIZE: 'BZ', BENIN: 'BJ', BHUTAN: 'BT', BOLIVIA: 'BO', BOSNIA: 'BA',
  BOTSWANA: 'BW', BRAZIL: 'BR', BRUNEI: 'BN', BULGARIA: 'BG', 'BURKINA FASO': 'BF', BURUNDI: 'BI', CAMBODIA: 'KH', CAMEROON: 'CM', CANADA: 'CA', CHAD: 'TD', CHILE: 'CL',
  CHINA: 'CN', COLOMBIA: 'CO', COMOROS: 'KM', CONGO: 'CG', 'COSTA RICA': 'CR', CROATIA: 'HR', CUBA: 'CU', CYPRUS: 'CY', CZECHIA: 'CZ', 'CZECH REPUBLIC': 'CZ', DENMARK: 'DK',
  DJIBOUTI: 'DJ', DOMINICA: 'DM', 'DOMINICAN REPUBLIC': 'DO', ECUADOR: 'EC', EGYPT: 'EG', 'EL SALVADOR': 'SV', 'EQUATORIAL GUINEA': 'GQ', ERITREA: 'ER', ESTONIA: 'EE', ESWATINI: 'SZ',
  ETHIOPIA: 'ET', FIJI: 'FJ', FINLAND: 'FI', FRANCE: 'FR', GABON: 'GA', GAMBIA: 'GM', GEORGIA: 'GE', GERMANY: 'DE', GHANA: 'GH', GREECE: 'GR', GRENADA: 'GD', GUATEMALA: 'GT',
  GUINEA: 'GN', GUYANA: 'GY', HAITI: 'HT', HONDURAS: 'HN', HUNGARY: 'HU', ICELAND: 'IS', INDIA: 'IN', INDONESIA: 'ID', IRAN: 'IR', IRAQ: 'IQ', IRELAND: 'IE', ISRAEL: 'IL',
  ITALY: 'IT', JAMAICA: 'JM', JAPAN: 'JP', JORDAN: 'JO', KAZAKHSTAN: 'KZ', KENYA: 'KE', KIRIBATI: 'KI', KOREA: 'KR', KUWAIT: 'KW', KYRGYZSTAN: 'KG', LAOS: 'LA', LATVIA: 'LV',
  LEBANON: 'LB', LESOTHO: 'LS', LIBERIA: 'LR', LIBYA: 'LY', LIECHTENSTEIN: 'LI', LITHUANIA: 'LT', LUXEMBOURG: 'LU', MADAGASCAR: 'MG', MALAWI: 'MW', MALAYSIA: 'MY', MALDIVES: 'MV',
  MALI: 'ML', MALTA: 'MT', MAURITANIA: 'MR', MAURITIUS: 'MU', MEXICO: 'MX', MOLDOVA: 'MD', MONACO: 'MC', MONGOLIA: 'MN', MONTENEGRO: 'ME', MOROCCO: 'MA', MOZAMBIQUE: 'MZ',
  MYANMAR: 'MM', NAMIBIA: 'NA', NEPAL: 'NP', NETHERLANDS: 'NL', 'NEW ZEALAND': 'NZ', NICARAGUA: 'NI', NIGER: 'NE', NIGERIA: 'NG', MACEDONIA: 'MK', NORWAY: 'NO', OMAN: 'OM',
  PAKISTAN: 'PK', PALAU: 'PW', PANAMA: 'PA', PARAGUAY: 'PY', PERU: 'PE', PHILIPPINES: 'PH', POLAND: 'PL', PORTUGAL: 'PT', QATAR: 'QA', ROMANIA: 'RO', RUSSIA: 'RU', RWANDA: 'RW',
  SAMOA: 'WS', 'SAN MARINO': 'SM', 'SAUDI ARABIA': 'SA', SENEGAL: 'SN', SERBIA: 'RS', SEYCHELLES: 'SC', 'SIERRA LEONE': 'SL', SINGAPORE: 'SG', SLOVAKIA: 'SK', SLOVENIA: 'SI',
  SOMALIA: 'SO', 'SOUTH AFRICA': 'ZA', SPAIN: 'ES', 'SRI LANKA': 'LK', SUDAN: 'SD', SURINAME: 'SR', SWEDEN: 'SE', SWITZERLAND: 'CH', SYRIA: 'SY', TAIWAN: 'TW', TAJIKISTAN: 'TJ',
  TANZANIA: 'TZ', THAILAND: 'TH', TOGO: 'TG', TONGA: 'TO', TRINIDAD: 'TT', TUNISIA: 'TN', TURKEY: 'TR', TURKMENISTAN: 'TM', UGANDA: 'UG', UKRAINE: 'UA', UAE: 'AE', 'UNITED ARAB EMIRATES': 'AE',
  UK: 'GB', 'UNITED KINGDOM': 'GB', USA: 'US', 'UNITED STATES': 'US', URUGUAY: 'UY', UZBEKISTAN: 'UZ', VANUATU: 'VU', VENEZUELA: 'VE', VIETNAM: 'VN', YEMEN: 'YE', ZAMBIA: 'ZM', ZIMBABWE: 'ZW',
  'UNITED STATES OF AMERICA': 'US',
};

const EMPTY_FORM = { name: '', accountNumber: '', streetAddress: '', country: '', city: '', state: '', zipCode: '', phoneNumber: '', faxNumber: '', email: '' };

const SECTIONS = [
  {
    title: 'Name Details', gridClassName: 'tw:sm:grid-cols-[2fr_1fr]',
    fields: [{ name: 'name', label: 'Name', required: true, maxLength: 35 }, { name: 'accountNumber', label: 'Account Number', maxLength: 15 }],
  },
  {
    title: 'Address Details', gridClassName: 'tw:sm:grid-cols-[1fr_1.5fr_1.5fr]',
    fields: [
      { name: 'streetAddress', label: 'Street Address', required: true, maxLength: 70, lines: 2, className: 'tw:sm:col-span-3' },
      { name: 'country', label: 'Country', required: true, maxLength: 2, placeholder: 'e.g. IN' },
      { name: 'city', label: 'City', required: true, maxLength: 17 },
      { name: 'state', label: 'State', maxLength: 9 },
      { name: 'zipCode', label: 'Zip / Postal', maxLength: 9 },
    ],
    note: 'Note: State & Zip are mandatory for local Customs in several regions.',
  },
  {
    title: 'Contact Details', gridClassName: 'tw:sm:grid-cols-3',
    fields: [
      { name: 'phoneNumber', label: 'Phone Number', maxLength: 25 },
      { name: 'faxNumber', label: 'Fax Number', maxLength: 25 },
      { name: 'email', label: 'Email', maxLength: 100, type: 'email' },
    ],
  },
];

// an address read by the AI may come as one block "street, city, state zip, country": split it
function formFromPrefill(prefill) {
  let city = prefill.city || '';
  let state = prefill.state || '';
  let country = prefill.country || '';
  let zip = prefill.zip || '';
  let street = prefill.address || '';
  if (country && country.length > 2) country = COUNTRY_CODES[country.toUpperCase().trim()] || country;
  if (street && !city && !state && street.includes(',')) {
    const parts = street.split(',').map((part) => part.trim());
    if (parts.length >= 3) {
      const possibleCountry = parts.pop();
      if (possibleCountry.length > 2) country = possibleCountry;
      const stateAndZip = parts.pop();
      const zipMatch = stateAndZip.match(/(\d{5,6})/);
      if (zipMatch) {
        zip = zipMatch[1];
        state = stateAndZip.replace(zip, '').trim();
      } else {
        state = stateAndZip;
      }
      city = parts.pop();
      street = parts.join(', ');
    }
  }
  return { name: prefill.name || '', streetAddress: street, city, state, country, zipCode: zip, phoneNumber: prefill.phone || '' };
}

function partyTypeOf(title) {
  const upperTitle = title.toUpperCase();
  if (upperTitle.includes('CONSIGNEE')) return 'CONSIGNEE';
  if (upperTitle.includes('BUYER')) return 'BUYER';
  if (upperTitle.includes('NOTIFY 1')) return 'NOTIFY 1';
  if (upperTitle.includes('NOTIFY 2')) return 'NOTIFY 2';
  if (upperTitle.includes('OVERSEAS')) return 'OVERSEAS AGENT';
  return 'SHIPPER';
}

function partyPayload(form, partyType) {
  const street = form.streetAddress || '';
  return {
    name: form.name,
    partyType,
    isShipper: partyType === 'SHIPPER',
    isConsignee: partyType === 'CONSIGNEE',
    isNotifyParty: partyType.includes('NOTIFY'),
    isBuyer: partyType === 'BUYER',
    isOverseasAgent: partyType === 'OVERSEAS AGENT',
    street: street.substring(0, 70),
    city: (form.city || '').substring(0, 17),
    stateProvince: form.state || '',
    zipPostcode: (form.zipCode || '').substring(0, 9),
    phoneNumber: form.phoneNumber || ' ',
    email: form.email || '',
    countryCode: form.country,
    currencyCode: 'INR',
    salesRep: 'ADMIN',
    status: 'Active',
    isCustomer: true,
    branches: [{
      branch: 'HEAD OFFICE',
      defaultAddress: true,
      contactPerson: form.name,
      address1: street.substring(0, 35),
      address2: street.length > 35 ? street.substring(35, 70) : '',
      city: form.city,
      state: form.state,
      country: form.country,
      pinCode: form.zipCode,
      phone: form.phoneNumber,
      email: form.email,
    }],
  };
}

const AddPartyModal = ({ isOpen, onClose, title, onSaved, prefillData }) => {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!isOpen) return;
    setForm((current) => (prefillData ? { ...current, ...formFromPrefill(prefillData) } : EMPTY_FORM));
  }, [isOpen, prefillData]);

  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value.toUpperCase() });
  const handleClear = () => setForm(EMPTY_FORM);

  const handleAdd = async () => {
    if (!form.name || !form.streetAddress || !form.country || !form.city) {
      toast.error('Name, Street Address, Country, and City are mandatory fields.');
      return;
    }
    try {
      const saved = await freightApi.saveParty(partyPayload(form, partyTypeOf(title)));
      toast.success('Party saved successfully to the Unified Party Master!');
      handleClear();
      onSaved?.(saved);
      onClose();
    } catch (error) {
      const data = error.response?.data;
      toast.error(error.response ? 'Validation Error: ' + (data?.message || data?.error || 'Unknown error') : 'Network Error');
    }
  };

  const footer = (
    <>
      <Button onClick={handleClear}>CLEAR</Button>
      <Button variant="success" onClick={handleAdd}><Save /> SAVE TO MASTER</Button>
    </>
  );

  return (
    <Modal open={isOpen} onClose={onClose} title={title} width={600} closeOnOutside={false} footer={footer}>
      {SECTIONS.map((section) => (
        <Section key={section.title} title={section.title}>
          <div className={cn('tw:grid tw:grid-cols-1 tw:items-end tw:gap-3', section.gridClassName)}>
            {section.fields.map((field) => (
              <Field key={field.name} label={field.label} required={field.required} layout="col" className={field.className}>
                {field.lines
                  ? <Textarea name={field.name} value={form[field.name]} onChange={handleChange} maxLength={field.maxLength} rows={field.lines} className="tw:resize-none" />
                  : <Input name={field.name} type={field.type} value={form[field.name]} onChange={handleChange} maxLength={field.maxLength} placeholder={field.placeholder} />}
              </Field>
            ))}
            {section.note && (
              <div className="tw:rounded-sm tw:border tw:border-border tw:bg-page tw:px-2 tw:py-1.5 tw:text-[10px] tw:text-head tw:italic tw:normal-case tw:sm:col-span-2">{section.note}</div>
            )}
          </div>
        </Section>
      ))}
    </Modal>
  );
};

export default AddPartyModal;
