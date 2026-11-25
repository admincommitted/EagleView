import { useState } from 'react';
import { FileText, MapPin, Package, Save, Ship, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { Button, DateInput, Field, Input, Modal, SelectBox, Tabs, TabsList, TabsTrigger, Textarea } from '@/components/ui';
import { freightOpsApi } from './FreightOpsParts/freightOpsApi';
import { BOOKING_OPTIONS, bookingDetail, emptyBooking, newContainer } from './FreightOpsParts/bookingForm';
import BookingContainers from './FreightOpsParts/BookingContainers';
import Heading from './FreightOpsParts/BookingHeading';

const TABS = [
  { value: 'general', label: 'Routing & General', icon: MapPin },
  { value: 'parties', label: 'Parties', icon: Users },
  { value: 'cargo', label: 'Cargo & Containers', icon: Package },
  { value: 'terms', label: 'Terms & Instructions', icon: FileText },
];

const PARTY_FIELDS = [
  { key: 'shipper', label: 'Shipper (Exporter)', placeholder: 'Name and full address...' },
  { key: 'consignee', label: 'Consignee', placeholder: 'Name and full address...' },
  { key: 'notifyParty', label: 'Notify Party', placeholder: 'Leave blank if Same as Consignee' },
  { key: 'cha', label: 'Customs Broker (CHA)', placeholder: 'Name and contact...' },
];

export default function SeaExportBookingForm({ onClose }) {
  const [activeTab, setActiveTab] = useState('general');
  const [booking, setBooking] = useState(emptyBooking);
  const [containers, setContainers] = useState([newContainer(1)]);
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => setBooking({ ...booking, [key]: value });
  const text = (key) => ({ value: booking[key], onChange: (event) => setField(key, event.target.value) });
  const choice = (key) => ({ value: booking[key], onValueChange: (value) => setField(key, value) });

  const addContainer = () => setContainers([...containers, newContainer(Date.now())]);
  const removeContainer = (id) => setContainers(containers.length > 1 ? containers.filter((container) => container.id !== id) : containers);
  const updateContainer = (id, key, value) => setContainers(containers.map((container) => (container.id === id ? { ...container, [key]: value } : container)));

  // the booking is recorded against its export job, with the container list in the detail
  const saveBooking = async () => {
    const jobNo = String(booking.jobNo || '').trim();
    if (!jobNo) {
      toast.error('Which export job is this booking for? Create the job in Export Entry first, then put its job number here.');
      return;
    }
    if (!String(booking.bookingNo || '').trim()) {
      toast.error('Give the booking a number');
      return;
    }
    const filled = containers.filter((container) => container.containerNo || container.weight || container.volume || container.pkgs);
    setSaving(true);
    try {
      await freightOpsApi.recordFreightEvent({ jobNo, jobKind: 'EXPORT', eventType: 'BOOKING', refNo: booking.bookingNo, detail: bookingDetail(booking, filled) });
      toast.success('Booking ' + booking.bookingNo + ' recorded on ' + jobNo + (filled.length ? ' with ' + filled.length + ' container line(s)' : ''));
      onClose?.();
    } catch (error) {
      toast.error('Not saved: ' + errorMessage(error));
    }
    setSaving(false);
  };

  const title = <span className="tw:flex tw:items-center tw:gap-3"><Ship className="tw:size-5 tw:text-primary" /> Ocean Export - Advanced Booking & Job Entry</span>;
  const footer = (
    <>
      <Button size="lg" onClick={onClose}>Cancel</Button>
      <Button size="lg" variant="default" onClick={saveBooking} disabled={saving} className={saving ? 'tw:cursor-wait' : undefined}>
        <Save /> Save Advanced Booking
      </Button>
    </>
  );

  return (
    <Modal open title={title} width={1100} onClose={onClose} closeOnOutside={false} footer={footer} className="tw:h-[90vh]" bodyClassName="tw:p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="entry" className="tw:overflow-x-auto tw:bg-page tw:px-4 tw:pt-3 tw:md:px-6">
          {TABS.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value}><Icon /> {label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="tw:flex-1 tw:p-4 tw:md:p-6">
        {activeTab === 'general' && (
          <div className="tw:grid tw:grid-cols-1 tw:gap-8 tw:md:grid-cols-2">
            <div>
              <Heading>Booking Details</Heading>
              <div className="tw:mb-4 tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2">
                <Field layout="col" label="Booking Ref"><Input data-allow-text {...text('bookingNo')} placeholder="BKG-2026-001" /></Field>
                <Field layout="col" label="Export Job No." note="Create the job in Export Entry first; the booking is recorded against it.">
                  <Input data-allow-text {...text('jobNo')} placeholder="the job this booking is for" />
                </Field>
                <Field layout="col" label="Master B/L No."><Input data-allow-text {...text('mblNo')} /></Field>
                <Field layout="col" label="House B/L No."><Input data-allow-text {...text('hblNo')} /></Field>
              </div>
              <Heading className="tw:mt-6">Vessel & Voyage</Heading>
              <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2">
                <Field layout="col" label="Vessel Name"><Input data-allow-text {...text('vessel')} /></Field>
                <Field layout="col" label="Voyage No."><Input data-allow-text {...text('voyage')} /></Field>
                <Field layout="col" label="Estimated Departure (ETD)"><DateInput {...choice('etd')} /></Field>
                <Field layout="col" label="Estimated Arrival (ETA)"><DateInput {...choice('eta')} /></Field>
              </div>
            </div>
            <div>
              <Heading>Routing</Heading>
              <div className="tw:grid tw:grid-cols-1 tw:gap-4">
                <Field layout="col" label="Place of Receipt"><Input data-allow-text /></Field>
                <Field layout="col" label="Port of Loading (POL)"><Input data-allow-text {...text('pol')} /></Field>
                <Field layout="col" label="Port of Discharge (POD)"><Input data-allow-text {...text('pod')} /></Field>
                <Field layout="col" label="Place of Delivery (Final Dest.)"><Input data-allow-text {...text('finalDest')} /></Field>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'parties' && (
          <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-2">
            {PARTY_FIELDS.map((party) => (
              <Field key={party.key} layout="col" label={party.label}>
                <Textarea rows={4} {...text(party.key)} placeholder={party.placeholder} />
              </Field>
            ))}
          </div>
        )}

        {activeTab === 'cargo' && (
          <BookingContainers containers={containers} onAdd={addContainer} onRemove={removeContainer} onChange={updateContainer} />
        )}

        {activeTab === 'terms' && (
          <div className="tw:grid tw:grid-cols-1 tw:gap-8 tw:md:grid-cols-2">
            <div>
              <Heading className="tw:border-0 tw:pb-0">Bill of Lading Terms</Heading>
              <div className="tw:grid tw:grid-cols-1 tw:gap-4">
                <Field layout="col" label="Freight Terms"><SelectBox {...choice('freightTerms')} options={BOOKING_OPTIONS.freightTerms} /></Field>
                <Field layout="col" label="B/L Type"><SelectBox {...choice('blType')} options={BOOKING_OPTIONS.blType} /></Field>
                <Field layout="col" label="Movement Type"><SelectBox {...choice('movementType')} options={BOOKING_OPTIONS.movementType} /></Field>
              </div>
            </div>
            <div>
              <Heading className="tw:border-0 tw:pb-0">Special Instructions</Heading>
              <Field layout="col" label="Handling Instructions"><Textarea rows={4} placeholder="Temperature control, hazardous info, etc." /></Field>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
