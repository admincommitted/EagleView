import { useState } from 'react';
import { applyDgft, dgftMerc, dgftSrNo, mercView, planDgft } from '../dgftMatch';
import { withOneDefault } from '../partyMasterData';

// ICEGATE takes a party name of 50 characters
const icegateName = (name) => (name ? String(name).trim().toUpperCase().slice(0, 50) : '');
const IEC_PATTERN = /^[A-Z0-9]{10}$/;

export default function useDgftFill({ formData, setFormData, selectedParty, setSelectedParty, customAlert }) {
  const [dgftOpen, setDgftOpen] = useState(false);

  const openDgft = () => {
    const iec = String(formData.taxId || '').trim().toUpperCase();
    if (!iec) return customAlert('Please enter an IEC Number first.');
    if (!IEC_PATTERN.test(iec)) return customAlert('IEC Number must be 10 characters - error');
    if (String(formData.name || '').trim().length < 3) return customAlert('Enter the party name first (DGFT needs at least its first 3 letters).');
    setDgftOpen(true);
  };

  // the DGFT [R]Merc / [F]Manuf value when it differs from the one here
  const changedMerc = (result) => {
    const dgftValue = dgftMerc(result?.details?.['Category of Exporters']);
    return dgftValue && dgftValue !== mercView(formData.mercManuf) ? dgftValue : '';
  };

  const addDgftBranches = (branches, result, option) => {
    const dgftName = icegateName(option?.name);
    const merc = changedMerc(result);
    const partyChanges = { ...(merc && { mercManuf: merc }), ...(dgftName && { name: dgftName }) };
    const changeNotes = (merc ? ` [R]Merc / [F]Manuf set to ${merc}.` : '') + (dgftName ? ` Party name changed to ${dgftName}.` : '');

    const current = selectedParty?.addresses || [];
    const { next, updated, added, skipped } = applyDgft(planDgft(branches, current), current);
    if (!updated && !added) {
      if (merc || dgftName) setFormData((form) => ({ ...form, ...partyChanges }));
      const outcome = skipped.length ? `Sr No ${skipped.join(', ')} already used by other addresses in this party. No branch changed.` : 'No branch to add or update.';
      return customAlert(outcome + changeNotes + ((merc || dgftName) ? ' Save the party.' : ''));
    }

    const srNoZero = next.findIndex((address) => String(address.branchSrNo) === '0');
    const addresses = withOneDefault(next, Math.max(0, srNoZero));
    setSelectedParty((party) => ({ ...(party || {}), ...formData, ...partyChanges, addresses }));
    setDgftOpen(false);

    const withoutGstin = addresses.filter((address) => address.ctxType === 'GSTIN' && !address.regNo).length;
    const tooLong = (branches || []).filter((branch) => branch.overflow).map(dgftSrNo);
    customAlert(`DGFT: ${updated} branch${updated === 1 ? '' : 'es'} updated, ${added} added.`
      + (skipped.length ? ` Sr No ${skipped.join(', ')} skipped (already used here).` : '')
      + changeNotes
      + (withoutGstin ? ` Type the GSTIN in ${withoutGstin} of them,` : '')
      + (tooLong.length ? ` Address of Sr ${tooLong.join(', ')} is longer than ICEGATE's 35 + 35 - shorten it,` : '')
      + ' then save the party.');
  };

  const applyDgftName = (name) => {
    if (name) setFormData((form) => ({ ...form, name: icegateName(name) }));
  };

  // only the empty party fields are filled; the DGFT name and [R]Merc / [F]Manuf replace the ones here
  const fillPartyFromDgft = (result, option) => {
    const dgftName = icegateName(option?.name);
    const details = result?.details || {};
    const firmAddress = result?.firmAddress || {};
    const next = { ...formData };
    const filled = [];
    const fillEmpty = (key, value) => {
      if (value && !String(formData[key] || '').trim()) {
        next[key] = String(value).toUpperCase();
        filled.push(key);
      }
    };
    fillEmpty('name', details['Firm Name']);
    // DGFT masks part of the PAN (X / *); a masked PAN is not taken
    if (details['PAN Number'] && !/[X*]/i.test(details['PAN Number'].slice(3, 9))) fillEmpty('panNumber', details['PAN Number']);
    fillEmpty('address', firmAddress.address1 ? [firmAddress.address1, firmAddress.address2].filter(Boolean).join(', ') : details.Address);
    fillEmpty('city', firmAddress.city);
    fillEmpty('state', firmAddress.state);
    fillEmpty('zip', firmAddress.pinCode);
    if (dgftName && dgftName !== formData.name) {
      next.name = dgftName;
      filled.push('name');
    }
    const dgftValue = dgftMerc(details['Category of Exporters']);
    if (dgftValue && dgftValue !== mercView(formData.mercManuf)) {
      next.mercManuf = dgftValue;
      filled.push('mercManuf');
    }
    setFormData(next);

    const otherFilled = filled.filter((key) => key !== 'mercManuf' && key !== 'name').length;
    customAlert((otherFilled ? 'Empty party fields were filled from DGFT. Existing values were kept.' : 'No empty party fields to fill. Existing values were kept.')
      + (filled.includes('mercManuf') ? ` [R]Merc / [F]Manuf set to ${dgftValue}.` : '')
      + (filled.includes('name') ? ` Party name changed to ${dgftName}.` : '')
      + ' Save the party to keep it.');
  };

  return { dgftOpen, setDgftOpen, openDgft, addDgftBranches, applyDgftName, fillPartyFromDgft };
}
