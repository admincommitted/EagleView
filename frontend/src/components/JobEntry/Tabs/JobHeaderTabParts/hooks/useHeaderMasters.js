import { useEffect, useState } from 'react';
import { getParties } from '@/utils/partiesCache';
import { useJobContext } from '../../../JobContext';
import { jobEntryApi } from '../../../jobEntryApi';
import { defaultChaLabel, listFrom } from './jobHeaderData';

const loadSafely = async (label, load) => {
  try {
    await load();
  } catch (error) {
    console.error(`${label}:`, error);
  }
};

const activeBondCodes = (bonds) => listFrom(bonds)
  .filter((bond) => bond.isActive !== false)
  .map((bond) => ({ code: bond.bondCode, name: bond.description, src: 'Bond master' }));

export default function useHeaderMasters() {
  const { setJobData } = useJobContext();
  const [parties, setParties] = useState([]);
  const [ports, setPorts] = useState([]);
  const [chaList, setChaList] = useState([]);
  const [bondMaster, setBondMaster] = useState([]);
  const [warehouseList, setWarehouseList] = useState([]);

  useEffect(() => {
    loadSafely('Job header parties', async () => setParties(await getParties()));
    loadSafely('Job header ports', async () => setPorts(listFrom(await jobEntryApi.ports())));
    loadSafely('Job header CHA master', async () => {
      const chaMasters = listFrom(await jobEntryApi.chaMaster());
      setChaList(chaMasters);
      const chaLabel = defaultChaLabel(chaMasters);
      if (chaLabel) setJobData((previous) => (previous.autoField_3 ? previous : { ...previous, chaCode: chaLabel, autoField_3: chaLabel }));
    });
    loadSafely('Bond / warehouse masters', async () => {
      const [bonds, warehouses] = await Promise.all([jobEntryApi.bonds(), jobEntryApi.warehouses()]);
      setBondMaster(activeBondCodes(bonds));
      setWarehouseList(listFrom(warehouses));
    });
  }, [setJobData]);

  return { parties, ports, chaList, bondMaster, warehouseList };
}
