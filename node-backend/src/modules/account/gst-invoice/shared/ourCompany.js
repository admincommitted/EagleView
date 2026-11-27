import { selectRows } from './invoiceDb.js';

export const COMPANY_NAME = 'COMMITTED CARGO CARE LIMITED';
const DELHI_STATE_CODE = '07';
const MAX_ADDRESS_LENGTH = 100;

const firstRow = async (sql, replacements = []) => (await selectRows(sql, replacements).catch(() => []))[0];

// our GSTIN: Company Profile, else the GST branch of our own name in the Party master
async function ourGstin(companyProfile) {
  if (companyProfile.gstin) return companyProfile.gstin;
  const name = companyProfile.legalName || companyProfile.companyName || COMPANY_NAME;
  const branch = await firstRow(
    `SELECT b.gstin FROM PartyBranches b JOIN Parties p ON p.id = b.partyId WHERE upper(trim(p.name)) = upper(trim(?))
      AND coalesce(b.gstin, '') <> '' ORDER BY b.isDefault DESC, b.id LIMIT 1`,
    [name],
  );
  return (branch && branch.gstin) || '';
}

// our office address: Company Profile, else the default company branch (Settings), else the party row with our GSTIN
async function fillAddressFromCompanyBranch(profile) {
  if (profile.address1) return;
  const branch = await firstRow(
    "SELECT address FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, id LIMIT 1",
  );
  if (!branch || !branch.address) return;
  const pinMatch = String(branch.address).match(/\b(\d{6})\b/);
  profile.address1 = String(branch.address).slice(0, MAX_ADDRESS_LENGTH);
  profile.address2 = '';
  profile.pincode = pinMatch ? pinMatch[1] : '';
  profile.city = profile.city || (/delhi/i.test(branch.address) ? 'NEW DELHI' : '');
}

/** Our GSTIN, state code / name and address - the state decides CGST + SGST or IGST. */
export async function ourGst() {
  const company =
    (await firstRow('SELECT companyName, legalName, gstin, state FROM CompanyProfile ORDER BY id LIMIT 1')) || {};
  const gstin = await ourGstin(company);
  const gstBranch = gstin
    ? await firstRow(
        'SELECT address1, address2, city, pinCode, phone, email1 FROM PartyBranches WHERE upper(gstin) = upper(?) ORDER BY isDefault DESC, id LIMIT 1',
        [gstin],
      )
    : null;
  const profile =
    (await firstRow(
      'SELECT companyName, legalName, address1, address2, city, pincode, phone, email FROM CompanyProfile ORDER BY id LIMIT 1',
    )) || {};
  await fillAddressFromCompanyBranch(profile);
  const code = /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : DELHI_STATE_CODE;
  const state = await firstRow('SELECT stateName FROM States WHERE countryId = 1 AND taxCode = ? LIMIT 1', [code]);
  let stateName = '';
  if (state) stateName = state.stateName;
  else if (code === DELHI_STATE_CODE) stateName = 'DELHI';
  const fromBranch = (key) => (gstBranch && gstBranch[key]) || '';
  return {
    gstin,
    code,
    name: stateName,
    legalName: profile.legalName || profile.companyName || company.legalName || company.companyName || COMPANY_NAME,
    addr1: profile.address1 || fromBranch('address1'),
    addr2: profile.address1 ? profile.address2 || '' : fromBranch('address2'),
    city: profile.city || fromBranch('city'),
    pin: profile.pincode || fromBranch('pinCode'),
    phone: profile.phone || fromBranch('phone'),
    email: profile.email || fromBranch('email1'),
  };
}

/** Indian states with a GST code, one per code. */
export async function indianStates() {
  const states = await selectRows(
    `SELECT stateName name, taxCode code FROM States WHERE countryId = 1 AND coalesce(taxCode, '') <> '' ORDER BY stateName`,
  ).catch(() => []);
  return states.filter((state, index, all) => all.findIndex((other) => other.code === state.code) === index);
}
