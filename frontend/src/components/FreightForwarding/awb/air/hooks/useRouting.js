import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/services/axiosInstance';
import { dataCache } from '../../../../CustomAutocomplete';
import { freightApi } from '../../../freightApi';
import { COUNTRY_CURRENCY_MAP } from './airWaybillData';

const AIRPORT_BOX_CACHE_KEY = `${API_BASE_URL}/locations/airports`;
const airportCodeOf = (airport) => airport.iataCode || airport.code || airport.title;

// "CITY - AIRPORT" name of the destination when it is missing (loaded from the database or typed by hand)
async function destinationNameOf(destAirport) {
  try {
    const airports = await freightApi.airportSearch(destAirport);
    const match = airports.find((airport) => airport.iataCode === destAirport || airport.code === destAirport);
    return match ? `${match.cityName || match.name} - ${match.airportName || match.name}` : null;
  } catch (error) {
    console.log(error);
    return null;
  }
}

// currency of the destination country, from the airport list of the airport boxes or from the server
async function destinationCurrencyOf(destAirport) {
  const cachedAirports = dataCache[AIRPORT_BOX_CACHE_KEY];
  if (cachedAirports) {
    const match = cachedAirports.find((airport) => airportCodeOf(airport) === destAirport);
    return match && match.countryCode ? COUNTRY_CURRENCY_MAP[match.countryCode] : null;
  }
  try {
    const answer = await freightApi.airportSearch(destAirport);
    const airports = Array.isArray(answer) ? answer : (answer.data || []);
    const match = airports.find((airport) => airportCodeOf(airport) === destAirport);
    return match ? COUNTRY_CURRENCY_MAP[match.countryCode || match.country || ''] : null;
  } catch {
    return null;
  }
}

export default function useRouting() {
  const [depAirport, setDepAirport] = useState('');
  const [destAirport, setDestAirport] = useState('');
  const [destAirportName, setDestAirportName] = useState('');
  const [by1, setBy1] = useState('');
  const [by2, setBy2] = useState('');
  const [by3, setBy3] = useState('');
  const [to1, setTo1] = useState('');
  const [to2, setTo2] = useState('');
  const [to3, setTo3] = useState('');
  const [flightNumber1, setFlightNumber1] = useState('');
  const [flightDate1, setFlightDate1] = useState('');
  const [flightTime1, setFlightTime1] = useState('');
  const [flightNumber2, setFlightNumber2] = useState('');
  const [flightDate2, setFlightDate2] = useState('');
  const [flightTime2, setFlightTime2] = useState('');
  const [flight3, setFlight3] = useState('');
  const [flightDate3, setFlightDate3] = useState('');
  const [arrivalDate1, setArrivalDate1] = useState('');
  const [destinationCurrency, setDestinationCurrency] = useState('');
  const [ccChargesDest, setCcChargesDest] = useState('');

  useEffect(() => {
    if (!destAirport || destAirport.length < 3 || (destAirportName && destAirportName.includes('-'))) return;
    const fillName = async () => {
      const name = await destinationNameOf(destAirport);
      if (name) setDestAirportName(name);
    };
    fillName();
  }, [destAirport, destAirportName]);

  useEffect(() => {
    if (!destAirport || destAirport.length !== 3) return;
    const fillCurrency = async () => {
      const currency = await destinationCurrencyOf(destAirport);
      if (currency) setDestinationCurrency(currency);
    };
    fillCurrency();
  }, [destAirport]);

  return {
    depAirport, setDepAirport, destAirport, setDestAirport, destAirportName, setDestAirportName,
    by1, setBy1, by2, setBy2, by3, setBy3, to1, setTo1, to2, setTo2, to3, setTo3,
    flightNumber1, setFlightNumber1, flightDate1, setFlightDate1, flightTime1, setFlightTime1,
    flightNumber2, setFlightNumber2, flightDate2, setFlightDate2, flightTime2, setFlightTime2,
    flight3, setFlight3, flightDate3, setFlightDate3, arrivalDate1, setArrivalDate1,
    destinationCurrency, setDestinationCurrency, ccChargesDest, setCcChargesDest,
  };
}
