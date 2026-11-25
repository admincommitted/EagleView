import { useEffect, useState } from 'react';
import { getMaster } from '@/utils/masterCache';
import { freightApi } from '../../../freightApi';

// master lists the HAWB screen checks against: airports, airlines, currencies, charge codes, special handling codes
export default function useAwbMasters() {
  const [masterAirports, setMasterAirports] = useState([]);
  const [masterAirlines, setMasterAirlines] = useState([]);
  const [masterCurrencies, setMasterCurrencies] = useState([]);
  const [masterCharges, setMasterCharges] = useState([]);
  const [masterSph, setMasterSph] = useState([]);

  useEffect(() => {
    const loadList = async (load, setList) => {
      try {
        const list = await load();
        if (Array.isArray(list)) setList(list);
      } catch (error) {
        console.error(error);
      }
    };
    loadList(freightApi.airportMaster, setMasterAirports);
    loadList(() => getMaster('/masters/airlines'), setMasterAirlines);
    loadList(() => getMaster('/masters/currencies'), setMasterCurrencies);
    loadList(freightApi.chargeMaster, setMasterCharges);
    loadList(freightApi.specialHandlingMaster, setMasterSph);
  }, []);

  return {
    masterAirports, setMasterAirports, masterAirlines, setMasterAirlines, masterCurrencies, setMasterCurrencies,
    masterCharges, setMasterCharges, masterSph, setMasterSph,
  };
}
