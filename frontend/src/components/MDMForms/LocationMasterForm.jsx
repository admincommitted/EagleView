import { useEffect, useState } from 'react';
import { Edit2, Globe, Map as MapIcon, MapPin, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, Card, DataTable, Field, Input, Section, SelectBox } from '@/components/ui';
import { mastersFormApi } from './masterKit/masterRecordsApi';
import { RowIconButton } from './masterFormExtras';

const EMPTY_STATE = { id: '', stateName: '', stateCode: '', taxCode: '' };
const EMPTY_CITY = { id: '', cityName: '', unlocCode: '' };

const STATE_FIELDS = [
  { key: 'stateName', label: 'State Name', required: true, placeholder: 'e.g. MAHARASHTRA', className: 'tw:md:flex-[2]' },
  { key: 'stateCode', label: 'State Code', required: true, placeholder: 'e.g. MH', className: 'tw:md:flex-1' },
  { key: 'taxCode', label: 'Tax Code', required: true, placeholder: 'e.g. 27', className: 'tw:md:flex-1' },
];
const CITY_FIELDS = [
  { key: 'cityName', label: 'City Name', required: true, placeholder: 'e.g. MUMBAI', className: 'tw:md:flex-[2]' },
  { key: 'unlocCode', label: 'UNLOC Code', placeholder: 'e.g. IN BOM', className: 'tw:md:flex-1' },
];

function EntryRow({ fields, values, onChange, editing, onSave, onCancel }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-end">
      {fields.map((field) => (
        <Field key={field.key} label={field.label} required={field.required} layout="col" className={field.className}>
          <Input required={field.required} placeholder={field.placeholder} data-allow-text="" value={values[field.key] || ''}
            onChange={(event) => onChange(field.key, event.target.value.toUpperCase())} />
        </Field>
      ))}
      <Button onClick={onSave}><Save /> {editing ? 'Update' : 'Add'}</Button>
      {editing && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
    </div>
  );
}

function Panel({ icon: Icon, title, children }) {
  return (
    <Card className="tw:min-w-0 tw:flex-1 tw:gap-0 tw:overflow-hidden tw:p-0">
      <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-1.5 tw:border-b tw:border-border tw:bg-secondary tw:px-4 tw:py-3 tw:text-[14px] tw:font-bold tw:text-foreground">
        <Icon className="tw:size-4" /> {title}
      </h3>
      <div className="tw:flex tw:flex-col tw:gap-4 tw:p-4">{children}</div>
    </Card>
  );
}

export default function LocationMasterForm() {
  const [locations, setLocations] = useState([]);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [selectedState, setSelectedState] = useState(null);
  const [stateForm, setStateForm] = useState(EMPTY_STATE);
  const [cityForm, setCityForm] = useState(EMPTY_CITY);

  const loadLocations = async () => {
    try {
      const data = await mastersFormApi.locations();
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch locations', error);
    }
  };
  useEffect(() => { loadLocations(); }, []);

  const selectedCountry = locations.find((country) => country.id.toString() === selectedCountryId);
  const activeState = selectedState && selectedCountry ? selectedCountry.states.find((state) => state.id === selectedState.id) : null;
  const countryId = parseInt(selectedCountryId, 10);

  const saveState = async () => {
    if (!selectedCountryId) {
      toast.error('Please select a country first.');
      return;
    }
    if (!stateForm.stateName || !stateForm.stateCode || !stateForm.taxCode) {
      toast.error('State Name, State Code, and Tax Code are mandatory.');
      return;
    }
    try {
      await mastersFormApi.saveLocationState({ ...stateForm, countryId });
      toast.success(`State ${stateForm.id ? 'updated' : 'added'} successfully.`);
      setStateForm(EMPTY_STATE);
      loadLocations();
    } catch (error) {
      toast.error(errorMessage(error) || 'Failed to save state.');
    }
  };

  const deleteState = async (id) => {
    try {
      await mastersFormApi.deleteLocationState(id);
      if (selectedState?.id === id) setSelectedState(null);
      loadLocations();
    } catch (error) {
      console.error(error);
    }
  };

  const saveCity = async () => {
    if (!selectedState) {
      toast.error('Please select a state first from the grid.');
      return;
    }
    if (!cityForm.cityName) {
      toast.error('City Name is mandatory.');
      return;
    }
    try {
      await mastersFormApi.saveLocationCity({ ...cityForm, stateId: selectedState.id, countryId });
      toast.success(`City ${cityForm.id ? 'updated' : 'added'} successfully.`);
      setCityForm(EMPTY_CITY);
      loadLocations();
    } catch (error) {
      toast.error(errorMessage(error) || 'Failed to save city.');
    }
  };

  const deleteCity = async (id) => {
    try {
      await mastersFormApi.deleteLocationCity(id);
      loadLocations();
    } catch (error) {
      console.error(error);
    }
  };

  const stateColumns = [
    {
      key: 'actions',
      header: 'Action',
      cell: (state) => (
        <>
          <RowIconButton icon={Edit2} title="Edit State" onClick={() => setStateForm(state)} />
          <RowIconButton icon={Trash2} title="Delete State" danger onClick={() => deleteState(state.id)} />
        </>
      ),
    },
    { key: 'stateName', header: 'State Name', className: 'tw:font-medium' },
    { key: 'stateCode', header: 'Code' },
    { key: 'taxCode', header: 'Tax Code' },
    { key: 'cities', header: 'Cities', align: 'center', cell: (state) => <Badge variant="info">{(state.cities || []).length}</Badge> },
  ];

  const cityColumns = [
    {
      key: 'actions',
      header: 'Action',
      cell: (city) => (
        <>
          <RowIconButton icon={Edit2} title="Edit City" onClick={() => setCityForm(city)} />
          <RowIconButton icon={Trash2} title="Delete City" danger onClick={() => deleteCity(city.id)} />
        </>
      ),
    },
    { key: 'cityName', header: 'City Name', className: 'tw:font-medium' },
    { key: 'unlocCode', header: 'UNLOC Code' },
  ];

  return (
    <div className="tw:flex tw:min-h-full tw:flex-col tw:gap-4 tw:bg-page tw:p-4 tw:normal-case tw:md:p-6">
      <h2 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-[18px] tw:font-bold tw:text-foreground">
        <Globe className="tw:size-5" /> Geographic Location Master
      </h2>

      <Card className="tw:gap-0 tw:p-4">
        <Section title="1. Select Country">
          <SelectBox className="tw:w-full tw:md:w-[300px]" placeholder="-- SELECT COUNTRY --" value={selectedCountryId}
            options={locations.map((country) => ({ value: String(country.id), label: `${country.name} (${country.code})` }))}
            onValueChange={(value) => { setSelectedCountryId(value); setSelectedState(null); }} />
          {!selectedCountryId && <p className="tw:m-0 tw:text-entry tw:text-muted-foreground">Select a country to manage its states and cities.</p>}
        </Section>
      </Card>

      {selectedCountry && (
        <div className="tw:flex tw:flex-col tw:gap-4 tw:lg:flex-row">
          <Panel icon={MapIcon} title={`Manage States for ${selectedCountry.name}`}>
            <EntryRow fields={STATE_FIELDS} values={stateForm} editing={Boolean(stateForm.id)} onSave={saveState}
              onChange={(key, value) => setStateForm({ ...stateForm, [key]: value })} onCancel={() => setStateForm(EMPTY_STATE)} />
            <DataTable columns={stateColumns} rows={selectedCountry.states || []} selectedKey={selectedState?.id} onRowClick={setSelectedState}
              emptyText="No states configured for this country." containerClassName="tw:rounded-md tw:border tw:border-border" />
          </Panel>

          <Panel icon={MapPin} title={`Cities ${activeState ? `in ${activeState.stateName}` : ''}`}>
            {activeState ? (
              <>
                <EntryRow fields={CITY_FIELDS} values={cityForm} editing={Boolean(cityForm.id)} onSave={saveCity}
                  onChange={(key, value) => setCityForm({ ...cityForm, [key]: value })} onCancel={() => setCityForm(EMPTY_CITY)} />
                <DataTable columns={cityColumns} rows={activeState.cities || []} emptyText="No cities added for this state yet."
                  containerClassName="tw:rounded-md tw:border tw:border-border" />
              </>
            ) : (
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-3 tw:p-8 tw:text-center tw:text-muted-foreground">
                <MapPin className="tw:size-8 tw:opacity-50" />
                Select a state from the left to view and manage its cities.
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
