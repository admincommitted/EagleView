import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/services/axiosInstance';
import { dataCache } from '@/components/CustomAutocomplete';
import { freightApi } from '../../../freightApi';
import { COUNTRY_CURRENCY_MAP } from './houseWaybillData';

const airportCodeOf = (airport) => airport.iataCode || airport.code || airport.title;

// airports, transit legs (to / by), flights and the destination currency
export default function useRoutingFields() {
  const [depAirport, setDepAirport] = useState('');
  const [destAirport, setDestAirport] = useState('');
  const [destAirportName, setDestAirportName] = useState('');
  const [to1, setTo1] = useState('');
  const [by1, setBy1] = useState('');
  const [to2, setTo2] = useState('');
  const [by2, setBy2] = useState('');
  const [to3, setTo3] = useState('');
  const [by3, setBy3] = useState('');
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

  // "CITY - AIRPORT" for a destination loaded from a saved AWB or typed without picking from the list
  useEffect(() => {
    if (!destAirport || destAirport.length < 3 || destAirportName.includes('-')) return;
    const loadAirportName = async () => {
      try {
        const airports = await freightApi.airportSearch(destAirport);
        const match = airports.find((airport) => airport.iataCode === destAirport || airport.code === destAirport);
        if (match) setDestAirportName(`${match.cityName || match.name} - ${match.airportName || match.name}`);
      } catch (error) {
        console.log(error);
      }
    };
    loadAirportName();
  }, [destAirport, destAirportName]);

  useEffect(() => {
    if (!destAirport || destAirport.length !== 3) return;
    const cachedAirports = dataCache[`${API_BASE_URL}/locations/airports`];
    if (cachedAirports) {
      const match = cachedAirports.find((airport) => airportCodeOf(airport) === destAirport);
      const currency = match?.countryCode && COUNTRY_CURRENCY_MAP[match.countryCode];
      if (currency) setDestinationCurrency(currency);
      return;
    }
    const loadCurrency = async () => {
      try {
        const answer = await freightApi.airportSearch(destAirport);
        const airports = Array.isArray(answer) ? answer : (answer.data || []);
        const match = airports.find((airport) => airportCodeOf(airport) === destAirport);
        const currency = match && COUNTRY_CURRENCY_MAP[match.countryCode || match.country || ''];
        if (currency) setDestinationCurrency(currency);
      } catch {
        // the currency stays as typed
      }
    };
    loadCurrency();
  }, [destAirport]);

  return {
    COUNTRY_CURRENCY_MAP,
    depAirport, setDepAirport, destAirport, setDestAirport, destAirportName, setDestAirportName,
    to1, setTo1, by1, setBy1, to2, setTo2, by2, setBy2, to3, setTo3, by3, setBy3,
    flightNumber1, setFlightNumber1, flightDate1, setFlightDate1, flightTime1, setFlightTime1,
    flightNumber2, setFlightNumber2, flightDate2, setFlightDate2, flightTime2, setFlightTime2,
    flight3, setFlight3, flightDate3, setFlightDate3, arrivalDate1, setArrivalDate1,
    destinationCurrency, setDestinationCurrency, ccChargesDest, setCcChargesDest,
  };
}
