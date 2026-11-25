import { useEffect, useState } from 'react';
import { getMaster } from '@/utils/masterCache';
import { exportEntryApi } from '../../../exportEntryApi';

const arrayOnly = (data) => (Array.isArray(data) ? data : null);
const arrayOrData = (data) => (Array.isArray(data) ? data : data?.data);

async function loadList(read, setList, what, rowsOf = arrayOnly) {
  try {
    const rows = rowsOf(await read());
    if (rows) setList(rows);
  } catch (error) {
    console.error(`Error fetching ${what}:`, error);
  }
}

// masters of the Items tab; the ICEGATE profile marked default (else the first) is the one documents are signed for
export default function useItemMasters() {
  const [states, setStates] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [drawbacksMaster, setDrawbacksMaster] = useState([]);
  const [rodtepsMaster, setRodtepsMaster] = useState([]);
  const [exportPoliciesMaster, setExportPoliciesMaster] = useState([]);
  const [esanchitMasters, setEsanchitMasters] = useState([]);
  const [schemesList, setSchemesList] = useState([]);
  const [icegateProfiles, setIcegateProfiles] = useState([]);
  const [defaultIcegateId, setDefaultIcegateId] = useState('');
  const [selectedIcegateProfile, setSelectedIcegateProfile] = useState('');

  useEffect(() => {
    loadList(() => getMaster('/masters/states'), setStates, 'states');
    loadList(() => getMaster('/masters/schemecodes'), setSchemesList, 'scheme codes', arrayOrData);
    loadList(exportEntryApi.itemTariffHeaders, setTariffs, 'tariff headers');
    loadList(exportEntryApi.itemDrawbacks, setDrawbacksMaster, 'drawbacks');
    loadList(exportEntryApi.itemRodteps, setRodtepsMaster, 'RoDTEP rates');
    loadList(exportEntryApi.itemExportPolicies, setExportPoliciesMaster, 'export policies');
    loadList(exportEntryApi.itemEsanchitMasters, setEsanchitMasters, 'esanchits');

    const loadIcegateProfiles = async () => {
      try {
        const answer = await exportEntryApi.itemIcegateProfiles();
        if (!answer.success || !answer.data) return;
        setIcegateProfiles(answer.data);
        const defaultProfile = answer.data.find((profile) => profile.isDefault) || answer.data[0];
        if (!defaultProfile) return;
        setSelectedIcegateProfile(defaultProfile.id);
        setDefaultIcegateId(defaultProfile.loginId);
      } catch (error) {
        console.error('Error fetching icegate profiles:', error);
      }
    };
    loadIcegateProfiles();
  }, []);

  return {
    states, tariffs, drawbacksMaster, rodtepsMaster, exportPoliciesMaster, esanchitMasters, schemesList,
    icegateProfiles, defaultIcegateId, selectedIcegateProfile, setSelectedIcegateProfile,
  };
}
