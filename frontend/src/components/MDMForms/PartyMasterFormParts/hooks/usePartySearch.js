import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { masterRecordsApi, mastersFormApi } from '../../masterKit/masterRecordsApi';
import { TYPE_FILTERS, partyFromServer } from '../partyMasterData';

// the master has ~30,000 parties from iCAFFE; the list shows the first 500 matches
const LIST_LIMIT = 500;
const FLAG_OF_TYPE = Object.fromEntries(TYPE_FILTERS.map((type) => [type.value, type.flag]));

const matchesTerm = (party, term) => Object.values(party).some((value) => value && String(value).toLowerCase().includes(term));

export default function usePartySearch({ setSelectedParty }) {
  const [partiesList, setPartiesList] = useState([]);
  const [globalLocations, setGlobalLocations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dirList, setDirList] = useState([]);
  const [dirBusy, setDirBusy] = useState(false);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const locations = await mastersFormApi.liteLocations();
        setGlobalLocations(Array.isArray(locations) ? locations : []);
      } catch (error) {
        console.error(error);
      }
    };
    const loadParties = async () => {
      try {
        const parties = await masterRecordsApi.list('parties', { _t: Date.now() });
        if (Array.isArray(parties) && parties.length > 0) setPartiesList(parties.map(partyFromServer));
      } catch (error) {
        console.error('Error fetching parties:', error);
      }
    };
    loadLocations();
    loadParties();
  }, []);

  const matchedParties = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return partiesList.filter((party) => {
      if (typeFilter && !party[FLAG_OF_TYPE[typeFilter]]) return false;
      return !term || matchesTerm(party, term);
    });
  }, [partiesList, searchTerm, typeFilter]);

  // parties of the master that are not in the list loaded on open (iCAFFE consignees not used yet: searchOnly)
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2 && typeFilter !== 'CONSIGNEE') {
      setDirList([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const rows = await mastersFormApi.findParties({ limit: 100, q: term, ...(typeFilter && { type: typeFilter }) });
        setDirList((Array.isArray(rows) ? rows : []).filter((row) => row.searchOnly));
      } catch {
        setDirList([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, typeFilter]);

  // a directory party is copied into the Party master (with its addresses) and opened
  const importDir = async (row) => {
    if (dirBusy) return;
    setDirBusy(true);
    try {
      const activated = await mastersFormApi.activateParty(row.id);
      if (!activated?.id) throw new Error(activated?.error || 'not found');
      const party = partyFromServer(activated);
      setPartiesList((list) => (list.some((item) => item.id === party.id) ? list : [party, ...list]));
      setSelectedParty(party);
      setDirList((list) => list.filter((item) => item.id !== row.id));
    } catch (error) {
      toast.error(`Could not open ${row.name}: ${errorMessage(error)}`);
    }
    setDirBusy(false);
  };

  return {
    partiesList, setPartiesList, globalLocations,
    searchTerm, setSearchTerm, typeFilter, setTypeFilter,
    filteredParties: matchedParties.slice(0, LIST_LIMIT), matchedCount: matchedParties.length,
    dirList, dirBusy, importDir,
  };
}
