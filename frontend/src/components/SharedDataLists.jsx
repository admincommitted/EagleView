import { useEffect, useState } from 'react';
import { getMaster } from '../utils/masterCache';
import { sharedWidgetsApi } from './common/sharedWidgetsApi';

async function loadInto(load, setRows) {
  try {
    const rows = await load();
    if (Array.isArray(rows)) setRows(rows);
  } catch (error) {
    console.error(error);
  }
}

function DataList({ id, rows, keyOf = (row) => row.id || row.code, valueOf, labelOf }) {
  return (
    <datalist id={id}>
      {rows.map((row) => <option key={keyOf(row)} value={valueOf(row)}>{labelOf(row)}</option>)}
    </datalist>
  );
}

// <datalist> lists of the app shell, used by the boxes with list="airport-code-list" etc. on the freight screens
const SharedDataLists = () => {
  const [airports, setAirports] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [countries, setCountries] = useState([]);
  const [iataAgents, setIataAgents] = useState([]);

  useEffect(() => {
    loadInto(sharedWidgetsApi.airports, setAirports);
    loadInto(() => getMaster('/masters/airlines'), setAirlines);
    loadInto(() => getMaster('/masters/currencies'), setCurrencies);
    loadInto(() => getMaster('/masters/countries'), setCountries);
    loadInto(() => getMaster('/masters/iataagents'), setIataAgents);
  }, []);

  return (
    <>
      <DataList
        id="airport-code-list"
        rows={airports}
        valueOf={(airport) => airport.iataCode || airport.code}
        labelOf={(airport) => `${airport.cityName || airport.name} - ${airport.airportName || airport.name}`}
      />
      <DataList id="airline-code-list" rows={airlines} valueOf={(airline) => airline.code} labelOf={(airline) => airline.name} />
      <DataList
        id="airline-list"
        rows={airlines}
        keyOf={(airline) => `full-${airline.id || airline.code}`}
        valueOf={(airline) => airline.name}
        labelOf={(airline) => `${airline.code} - ${airline.prefix}`}
      />
      <DataList id="currency-list" rows={currencies} valueOf={(currency) => currency.code} labelOf={(currency) => currency.name} />
      <DataList id="country-list" rows={countries} valueOf={(country) => country.code} labelOf={(country) => country.name} />
      <DataList id="iata-agent-list" rows={iataAgents} valueOf={(agent) => agent.code} labelOf={(agent) => `${agent.name} - ${agent.city}`} />
    </>
  );
};

export default SharedDataLists;
