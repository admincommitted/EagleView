import { useEffect, useMemo, useState } from 'react';
import { getMaster } from '@/utils/masterCache';
import { getParties } from '@/utils/partiesCache';
import { loadForeignPorts } from '@/utils/foreignPorts';
import { useExportContext } from '../../../ExportContext';
import { exportEntryApi } from '../../../exportEntryApi';

const listFrom = (answer) => (Array.isArray(answer) ? answer : answer?.data || []);

const loadSafely = async (label, load) => {
  try {
    await load();
  } catch (error) {
    console.error(`${label}:`, error);
  }
};

// foreign airports as customs port codes: country + IATA code (AE + DXB = AEDXB); Indian airports are in the ports master
const foreignAirportsFrom = (airports) => listFrom(airports)
  .filter((airport) => airport.iataCode && airport.countryCode && String(airport.countryCode).toUpperCase() !== 'IN')
  .map((airport) => ({
    portCode: `${airport.countryCode}${airport.iataCode}`.toUpperCase(),
    iataCode: airport.iataCode,
    countryCode: String(airport.countryCode).toUpperCase(),
    portName: airport.cityName + (airport.airportName ? ` - ${airport.airportName}` : ''),
    category: 'AIR',
  }));

const isIndianPort = (port) => /^IN/i.test(String(port.portCode || '')) || /INDIA/i.test(String(port.country || ''));

// Indian ports (customs location, loading port, gateway) follow the shipment mode; ICEGATE wants foreign ports as
// UN/LOCODE (AEDXB), never the bare IATA code
function indianPortsFor(ports, shipmentMode) {
  const indian = ports.filter(isIndianPort);
  const byMode = shipmentMode === 'AIR' ? indian.filter((port) => port.category === 'AIR')
    : shipmentMode === 'SEA' ? indian.filter((port) => port.category !== 'AIR') : indian;
  return byMode.length ? byMode : indian;
}

function foreignPortsFor(ports, foreignAirports, locodes, shipmentMode) {
  const listed = [...(shipmentMode === 'AIR' ? foreignAirports : []), ...ports.filter((port) => !isIndianPort(port))];
  const listedCodes = new Set(listed.map((port) => String(port.portCode || '').toUpperCase()));
  return listed.concat(locodes.filter((port) => !listedCodes.has(port.portCode)));
}

export default function useExportMasters(shipmentMode) {
  const { setExportData } = useExportContext();
  const [parties, setParties] = useState([]);
  const [chas, setChas] = useState([]);
  const [ports, setPorts] = useState([]);
  const [states, setStates] = useState([]);
  const [countries, setCountries] = useState([]);
  const [uqcs, setUqcs] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [foreignAirports, setForeignAirports] = useState([]);
  const [locodes, setLocodes] = useState([]);

  useEffect(() => {
    loadSafely('SB header parties', async () => setParties(listFrom(await getParties())));
    loadSafely('SB header CHA master', async () => {
      const chaRows = listFrom(await exportEntryApi.headerChaMaster());
      setChas(chaRows);
      const defaultCha = chaRows.find((cha) => cha.isDefault);
      if (defaultCha) setExportData((prev) => (prev.chaNo ? prev : { ...prev, chaNo: defaultCha.chaCode, chaName: defaultCha.chaName, chaAddress: defaultCha.chaAddress }));
    });
    loadSafely('SB header airports', async () => setForeignAirports(foreignAirportsFrom(await exportEntryApi.headerAirports())));
    loadSafely('SB header countries', async () => setCountries(listFrom(await getMaster('/masters/countries'))));
    loadSafely('SB header UQCs', async () => setUqcs(listFrom(await getMaster('/masters/uqcs'))));
    loadSafely('SB header vessels', async () => setVessels(listFrom(await exportEntryApi.headerVessels())));
    loadSafely('SB header airlines', async () => setAirlines(listFrom(await getMaster('/masters/airlines'))));
    loadSafely('SB header warehouses', async () => setWarehouses(listFrom(await exportEntryApi.headerWarehouses())));
    loadSafely('SB header states', async () => setStates(listFrom(await getMaster('/masters/states'))));
    loadSafely('SB header ports', async () => {
      const portRows = listFrom(await getMaster('/masters/ports'));
      setPorts(portRows.map((port) => ({ portCode: port.portCode, portName: port.portName, category: port.category || 'ICD' })));
    });
    loadSafely('SB header foreign ports', async () => setLocodes(await loadForeignPorts()));
  }, [setExportData]);

  const indianPorts = useMemo(() => indianPortsFor(ports, shipmentMode), [ports, shipmentMode]);
  const foreignPorts = useMemo(() => foreignPortsFor(ports, foreignAirports, locodes, shipmentMode), [ports, foreignAirports, locodes, shipmentMode]);

  return { parties, chas, states, countries, uqcs, vessels, airlines, warehouses, indianPorts, foreignPorts };
}
