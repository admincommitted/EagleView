export const formatAwbNumber = (fullAwbNumber) =>
  (fullAwbNumber.length === 11 ? fullAwbNumber.substring(0, 3) + '-' + fullAwbNumber.substring(3) : fullAwbNumber);

export const codeOptions = (rows, labelKey) => rows.map((row) => ({ value: row.code, label: row[labelKey] }));

export const firstBranchOf = (party) => (party.branches && party.branches.length > 0 ? party.branches[0] : {});

export function partyContact(party) {
  const branch = firstBranchOf(party);
  return {
    address: [branch.address1, branch.address2, branch.city, branch.state, branch.country || party.countryCode].filter(Boolean).join(', '),
    pin: branch.pinCode || party.zipPostcode || '',
    mobile: branch.mobile || branch.phone || party.phoneNumber || '',
    email: branch.email1 || party.email || '',
    gst: branch.gstin || party.taxId || '',
  };
}
