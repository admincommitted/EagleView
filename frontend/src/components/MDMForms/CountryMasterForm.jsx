import { Fragment, useEffect, useMemo, useState } from 'react';
import { CornerDownRight, Edit2, Globe, Map as MapIcon, Plane, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import {
  Badge, Button, Field, Input, Section, SelectBox, StatCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { askDelete } from './switchRow';
import { MasterPage } from './masterKit/MasterPage';
import { masterActionsColumn } from './masterKit/masterColumns';
import { mastersFormApi, masterRecordsApi } from './masterKit/masterRecordsApi';
import { RowIconButton } from './masterFormExtras';

const EMPTY_COUNTRY = { id: '', code: '', name: '' };
const EMPTY_STATE = { id: '', stateName: '', stateCode: '', taxCode: '' };
const EMPTY_CITY = {
  id: '', stateId: '', cityName: '', airportName: '', iataCode: '', portCode: '', portName: '', portCategory: 'AIR',
  chaCode: '', chaName: '', division: 'BOTH (IMP/EXP)', isActive: true, isSez: false,
};

const STATE_FIELDS = [
  { key: 'stateName', label: 'State Name', className: 'tw:md:flex-[2_1_200px]' },
  { key: 'stateCode', label: 'State Code', className: 'tw:md:flex-[1_1_100px]' },
  { key: 'taxCode', label: 'Tax Code', className: 'tw:md:flex-[1_1_100px]' },
];
const CITY_FIELDS = [
  { key: 'cityName', label: 'City Name', required: true, className: 'tw:md:flex-[1.5_1_120px]' },
  { key: 'airportName', label: 'Full Airport Name', className: 'tw:md:flex-[2_1_150px]' },
  { key: 'iataCode', label: 'IATA Code', maxLength: 3, className: 'tw:md:flex-[1_1_60px]' },
];
const GRID_HEADERS = ['Action', 'State Name', 'Tax Code', 'City Name', 'Full Airport Name', 'IATA Code'];

const countryFormOf = (country) => ({ id: country.id, code: country.code, name: country.name });
const stateFormOf = (state) => ({ id: state.id, stateName: state.stateName, stateCode: state.stateCode, taxCode: state.taxCode });
const portCountOf = (country) => country.states?.reduce((total, state) => total + (state.cities?.length || 0), 0) || 0;
const includesText = (value, term) => Boolean(value?.toLowerCase().includes(term));
const cityMatches = (city, term) => includesText(city.cityName, term) || includesText(city.airportName, term) || includesText(city.iataCode, term);

const countryMatches = (country, term) => includesText(country.name, term) || includesText(country.code, term)
  || (country.states || []).some((state) => includesText(state.stateName, term) || (state.cities || []).some((city) => cityMatches(city, term)));

function FlagImage({ code, width, className }) {
  return (
    <img src={`https://flagcdn.com/w${width}/${(code || 'xx').toLowerCase()}.png`} alt={code} className={cn('tw:rounded-sm', className)}
      onError={(event) => { event.currentTarget.hidden = true; }} />
  );
}

const LIST = {
  title: 'Countries',
  icon: Globe,
  searchPlaceholder: 'Search countries...',
  primaryText: (country) => <span className="tw:flex tw:items-center tw:gap-2"><FlagImage code={country.code} width={20} className="tw:w-4" /> {country.name}</span>,
  secondaryText: (country) => `CODE: ${country.code} · ${portCountOf(country)} PORTS`,
};

export default function CountryMasterForm() {
  const [locations, setLocations] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [selectedCountryId, setSelectedCountryId] = useState(null);
  const [countryForm, setCountryForm] = useState(EMPTY_COUNTRY);
  const [stateForm, setStateForm] = useState(EMPTY_STATE);
  const [cityForm, setCityForm] = useState(EMPTY_CITY);
  const [saving, setSaving] = useState(false);

  const loadStats = async () => {
    try {
      setStats(await mastersFormApi.locationStats());
    } catch (error) {
      console.error(error);
    }
  };

  const loadLocations = async () => {
    loadStats();
    try {
      const data = await mastersFormApi.locations();
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };
  useEffect(() => { loadLocations(); }, []);

  const selectedCountry = locations.find((country) => country.id === selectedCountryId);
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return locations.filter((country) => countryMatches(country, term));
  }, [locations, search]);

  const pickCountry = (country) => {
    setSelectedCountryId(country.id);
    setCountryForm(countryFormOf(country));
    setStateForm(EMPTY_STATE);
    setCityForm(EMPTY_CITY);
  };

  const saveCountry = async () => {
    if (!countryForm.code || !countryForm.name) {
      toast.error('Country Code and Name are required.');
      return;
    }
    setSaving(true);
    try {
      if (countryForm.id) await masterRecordsApi.update('countries', countryForm.id, countryForm);
      else await masterRecordsApi.create('countries', countryForm);
      setCountryForm(EMPTY_COUNTRY);
      loadLocations();
    } catch (error) {
      toast.error(errorMessage(error) || 'Failed to save country.');
    } finally {
      setSaving(false);
    }
  };

  const saveState = async () => {
    if (!stateForm.stateName || !stateForm.stateCode || !stateForm.taxCode) {
      toast.error('State Name, State Code, and Tax Code are mandatory.');
      return;
    }
    try {
      await mastersFormApi.saveLocationState({ ...stateForm, countryId: selectedCountry.id });
      setStateForm(EMPTY_STATE);
      loadLocations();
    } catch (error) {
      toast.error(errorMessage(error) || 'Failed to save state.');
    }
  };

  const saveCity = async () => {
    if (!cityForm.stateId) {
      toast.error('Please select a State for this location.');
      return;
    }
    if (!cityForm.cityName) {
      toast.error('City Name is mandatory.');
      return;
    }
    try {
      await mastersFormApi.saveLocationCity({ ...cityForm, countryId: selectedCountry.id });
      setCityForm({ ...EMPTY_CITY, stateId: cityForm.stateId });
      loadLocations();
    } catch (error) {
      toast.error(errorMessage(error) || 'Failed to save location.');
    }
  };

  const deleteRow = async (question, remove) => {
    if (!(await askDelete(question))) return;
    try {
      await remove();
      loadLocations();
    } catch (error) {
      toast.error(`Not deleted: ${errorMessage(error)}`);
    }
  };

  const editCity = (state, city) => {
    setStateForm(stateFormOf(state));
    setCityForm({ id: city.id, stateId: state.id, cityName: city.cityName, airportName: city.airportName || '', iataCode: city.iataCode || '' });
  };

  const setStateField = (name) => (value) => setStateForm((current) => ({ ...current, [name]: value }));
  const setCityField = (name) => (value) => setCityForm((current) => ({ ...current, [name]: value }));

  const cityTerm = citySearch.toLowerCase();
  const stateGroups = (selectedCountry?.states || [])
    .map((state) => {
      const cities = state.cities || [];
      return { state, cities: cityTerm ? cities.filter((city) => cityMatches(city, cityTerm)) : cities };
    })
    .filter(({ state, cities }) => !cityTerm || cities.length > 0 || includesText(state.stateName, cityTerm));

  const master = {
    filtered,
    search,
    setSearch,
    // the list and grid highlight the country whose states are shown
    form: { id: selectedCountryId },
    saving,
    save: saveCountry,
    clearForm: () => { setCountryForm(EMPTY_COUNTRY); setSelectedCountryId(null); },
    editRecord: pickCountry,
  };

  const columns = [
    { key: 'name', header: 'Country', cell: (country) => <span className="tw:flex tw:items-center tw:gap-2 tw:font-semibold"><FlagImage code={country.code} width={20} className="tw:w-4" /> {country.name}</span> },
    { key: 'code', header: 'Code', cell: (country) => <Badge variant="info">{country.code}</Badge> },
    { key: 'ports', header: 'Ports', align: 'center', cell: portCountOf },
    masterActionsColumn({ onEdit: pickCountry }),
  ];

  return (
    <MasterPage master={master} list={LIST} icon={Globe} formTitle={countryForm.id ? 'Update Country' : 'Add New Country'} columns={columns}>
      <div className="tw:flex tw:flex-col tw:gap-4">
        {stats && (
          <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:lg:grid-cols-4">
            <StatCard label="Total Countries" value={stats.countries} icon={Globe} />
            <StatCard label="Global Airports" value={stats.airports} icon={Plane} tone="success" />
            <StatCard label="Mapped States" value={stats.states} icon={MapIcon} tone="warning" />
            <StatCard label="Registered Cities" value={`${(stats.cities / 1000).toFixed(1)}k`} tone="neutral" />
          </div>
        )}

        <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-end">
          <Field label="Country Code" required layout="col" className="tw:md:w-[150px]">
            <Input required placeholder="E.G. IN" maxLength={2} className="tw:uppercase" data-allow-text="" value={countryForm.code}
              onChange={(event) => setCountryForm({ ...countryForm, code: event.target.value.toUpperCase() })} />
          </Field>
          <Field label="Country Name" required layout="col" className="tw:flex-1">
            <Input required placeholder="ENTER FULL COUNTRY NAME" className="tw:uppercase" data-allow-text="" value={countryForm.name}
              onChange={(event) => setCountryForm({ ...countryForm, name: event.target.value.toUpperCase() })} />
          </Field>
        </div>

        {selectedCountry && (
          <Section
            title={(
              <span className="tw:flex tw:items-center tw:gap-2 tw:uppercase">
                <MapIcon className="tw:size-4" /> Unified Master: {selectedCountry.name} <FlagImage code={selectedCountry.code} width={40} className="tw:w-6" />
              </span>
            )}
            bodyClassName="tw:gap-4"
          >
            <Section title="1. State Registration" className="tw:rounded-md tw:border tw:border-border tw:bg-background tw:p-3">
              <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:flex-wrap tw:md:items-end">
                {STATE_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label} required layout="col" className={field.className}>
                    <Input required placeholder={`${field.label.toUpperCase()} *`} data-allow-text="" value={stateForm[field.key] || ''}
                      onChange={(event) => setStateField(field.key)(event.target.value.toUpperCase())} />
                  </Field>
                ))}
                <Button variant="secondary" onClick={saveState}>{stateForm.id ? 'Update State' : '+ Add State'}</Button>
              </div>
            </Section>

            <Section title="2. Location Registration" className="tw:rounded-md tw:border tw:border-border tw:bg-background tw:p-3">
              <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:flex-wrap tw:md:items-end">
                <Field label="Select State" required layout="col" className="tw:md:flex-[1.5_1_120px]">
                  <SelectBox required placeholder="-- SELECT STATE --" value={cityForm.stateId} onValueChange={setCityField('stateId')}
                    options={(selectedCountry.states || []).map((state) => ({ value: String(state.id), label: state.stateName }))} />
                </Field>
                {CITY_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label} required={field.required} layout="col" className={field.className}>
                    <Input required={field.required} placeholder={field.label.toUpperCase()} maxLength={field.maxLength} data-allow-text="" value={cityForm[field.key] || ''}
                      onChange={(event) => setCityField(field.key)(event.target.value.toUpperCase())} />
                  </Field>
                ))}
                <Button onClick={saveCity}>{cityForm.id ? 'Update Location' : '+ Add Location'}</Button>
              </div>
            </Section>

            <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:justify-between">
              <h4 className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-foreground tw:uppercase">States &amp; Ports in {selectedCountry.name}</h4>
              <Input leftIcon={Search} placeholder="Search City, Airport or IATA..." data-allow-text="" className="tw:md:w-[240px]" value={citySearch}
                onChange={(event) => setCitySearch(event.target.value)} />
            </div>

            <Table containerClassName="tw:max-h-[600px] tw:rounded-md tw:border tw:border-border" className="tw:min-w-[800px]">
              <TableHeader sticky>
                <TableRow>
                  {GRID_HEADERS.map((header) => <TableHead key={header}>{header}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {stateGroups.map(({ state, cities }) => (
                  <Fragment key={state.id}>
                    <TableRow className="tw:bg-secondary tw:even:bg-secondary">
                      <TableCell>
                        <RowIconButton icon={Edit2} title="Edit State" onClick={() => setStateForm(stateFormOf(state))} />
                        <RowIconButton icon={Trash2} title="Delete State" danger
                          onClick={() => deleteRow('Delete this state and ALL its cities?', () => mastersFormApi.deleteLocationState(state.id))} />
                      </TableCell>
                      <TableCell className="tw:text-entry tw:font-bold">{state.stateName}</TableCell>
                      <TableCell className="tw:text-center tw:font-bold">{state.taxCode}</TableCell>
                      <TableCell colSpan={3}>
                        {cities.length > 0
                          ? <Badge variant="info">{cities.length} LOCATION{cities.length > 1 ? 'S' : ''} ADDED</Badge>
                          : <span className="tw:text-[10px] tw:text-muted-foreground tw:italic">No locations added yet.</span>}
                      </TableCell>
                    </TableRow>
                    {cities.map((city) => (
                      <TableRow key={city.id}>
                        <TableCell>
                          <RowIconButton icon={Edit2} title="Edit Location" onClick={() => editCity(state, city)} />
                          <RowIconButton icon={Trash2} title="Delete Location" danger
                            onClick={() => deleteRow('Delete this city / location?', () => mastersFormApi.deleteLocationCity(city.id))} />
                        </TableCell>
                        <TableCell className="tw:text-right tw:text-muted-foreground"><CornerDownRight className="tw:ml-auto tw:size-3.5" /></TableCell>
                        <TableCell />
                        <TableCell className="tw:font-bold tw:text-head">{city.cityName}</TableCell>
                        <TableCell className="tw:text-muted-foreground">{city.airportName || '-'}</TableCell>
                        <TableCell className="tw:text-center tw:font-bold">{city.iataCode ? <Badge variant="neutral">{city.iataCode}</Badge> : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
                {!selectedCountry.states?.length && (
                  <TableRow>
                    <TableCell colSpan={GRID_HEADERS.length} className="tw:p-6 tw:text-center tw:text-entry tw:text-muted-foreground">No data found. Please add a state first.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Section>
        )}
      </div>
    </MasterPage>
  );
}
