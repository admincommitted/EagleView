import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/services/axiosInstance';
import { dataCache } from '../../../../CustomAutocomplete';
import { freightApi } from '../../../freightApi';
import { COUNTRY_CURRENCY_MAP } from './masterWaybillData';

// the airport list the airport boxes already loaded (CustomAutocomplete keys it by the full API url)
const AIRPORT_CACHE_KEY = `${API_BASE_URL}/locations/airports`;
const isAirportCode = (airport, code) => (airport.iataCode || airport.code || airport.title) === code;

// airports, carriers and flights of the master, and the destination currency that follows the destination airport
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

  const takeCurrencyOf = (countryCode) => {
    const currency = COUNTRY_CURRENCY_MAP[countryCode];
    if (currency) setDestinationCurrency(currency);
  };

  // a destination loaded from the database or typed by hand gets its "CITY - AIRPORT" name
  useEffect(() => {
    if (!destAirport || destAirport.length < 3 || destAirportName?.includes('-')) return;
    const resolveAirportName = async () => {
      try {
        const airports = await freightApi.airportSearch(destAirport);
        const match = airports.find((airport) => airport.iataCode === destAirport || airport.code === destAirport);
        if (match) setDestAirportName(`${match.cityName || match.name} - ${match.airportName || match.name}`);
      } catch (error) {
        console.error(error);
      }
    };
    resolveAirportName();
  }, [destAirport, destAirportName]);

  useEffect(() => {
    if (destAirport?.length !== 3) return;
    const cachedAirports = dataCache[AIRPORT_CACHE_KEY];
    if (cachedAirports) {
      const match = cachedAirports.find((airport) => isAirportCode(airport, destAirport));
      if (match?.countryCode) takeCurrencyOf(match.countryCode);
      return;
    }
    const loadAirportCurrency = async () => {
      try {
        const answer = await freightApi.airportSearch(destAirport);
        const airports = Array.isArray(answer) ? answer : (answer.data || []);
        const match = airports.find((airport) => isAirportCode(airport, destAirport));
        if (match) takeCurrencyOf(match.countryCode || match.country || '');
      } catch {
        // the currency stays as typed
      }
    };
    loadAirportCurrency();
  }, [destAirport]); // eslint-disable-line react-hooks/exhaustive-deps -- only a new destination changes the currency

  const handleDestAirportSelect = (option) => {
    if (!option) return;
    setDestAirportName(option.subtitle || '');
    if (option.countryCode) takeCurrencyOf(option.countryCode);
  };

  return {
    COUNTRY_CURRENCY_MAP,
    depAirport, setDepAirport, destAirport, setDestAirport, destAirportName, setDestAirportName,
    by1, setBy1, by2, setBy2, by3, setBy3, to1, setTo1, to2, setTo2, to3, setTo3,
    flightNumber1, setFlightNumber1, flightDate1, setFlightDate1, flightTime1, setFlightTime1,
    flightNumber2, setFlightNumber2, flightDate2, setFlightDate2, flightTime2, setFlightTime2,
    flight3, setFlight3, flightDate3, setFlightDate3, arrivalDate1, setArrivalDate1,
    destinationCurrency, setDestinationCurrency, handleDestAirportSelect,
  };
}
