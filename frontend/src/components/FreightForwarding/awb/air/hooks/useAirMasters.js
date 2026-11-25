import { useEffect, useState } from 'react';
import { getMaster } from '@/utils/masterCache';
import { freightApi } from '../../../freightApi';

const loadList = async (load, setList) => {
  try {
    const answer = await load();
    if (Array.isArray(answer)) setList(answer);
  } catch (error) {
    console.error(error);
  }
};

export default function useAirMasters() {
  const [masterAirports, setMasterAirports] = useState([]);
  const [masterAirlines, setMasterAirlines] = useState([]);
  const [masterCurrencies, setMasterCurrencies] = useState([]);
  const [masterCharges, setMasterCharges] = useState([]);
  const [masterSph, setMasterSph] = useState([]);

  useEffect(() => {
    loadList(() => freightApi.airportMaster(), setMasterAirports);
    loadList(() => getMaster('/masters/airlines'), setMasterAirlines);
    loadList(() => getMaster('/masters/currencies'), setMasterCurrencies);
    loadList(() => freightApi.chargeMaster(), setMasterCharges);
    loadList(() => freightApi.specialHandlingMaster(), setMasterSph);
  }, []);

  return {
    masterAirports, setMasterAirports, masterAirlines, setMasterAirlines, masterCurrencies, setMasterCurrencies,
    masterCharges, setMasterCharges, masterSph, setMasterSph,
  };
}
