import { deleteData, getData, postData, putData, refusedUnlessOk } from './purchaseApi';

export const fleetApi = {
  lorryReceipts: async (filters) => refusedUnlessOk(await getData('/fleet/lr', { params: filters })),
  masters: () => getData('/fleet/masters'),
  nextLrNo: () => getData('/fleet/lr/next-no'),
  saveLorryReceipt: async (lorryReceipt) => refusedUnlessOk(await postData('/fleet/lr', lorryReceipt)),
  updateLorryReceipt: async (id, changes) => refusedUnlessOk(await putData(`/fleet/lr/${id}`, changes)),
  deleteLorryReceipt: async (id) => refusedUnlessOk(await deleteData(`/fleet/lr/${id}`)),
  postDriverAdvance: async (id, ledgers) => refusedUnlessOk(await postData(`/fleet/lr/${id}/post-advance`, ledgers)),
};

/** The masters only fill the pickers; the screens still work when they cannot be read. */
export async function fleetMastersOrEmpty() {
  try {
    return await fleetApi.masters();
  } catch {
    return {};
  }
}
