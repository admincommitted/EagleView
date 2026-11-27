import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../../config/database.js';

/**
 * Who we are, for the AWB documents (manifest, SLI, DO, XFWB forwarder block ...): name from Settings > Company
 * profile, address / GSTIN / phone from the AWB's branch (Settings > Branches). When the company profile is empty the
 * iCAFFE invoice head is the fallback, as the GST invoice does. Bank and e-invoice fields of the profile are never read.
 */
const HEAD_OFFICE_DEFAULT = {
  name: 'COMMITTED CARGO CARE LIMITED',
  address: 'A-406, Road No. 4, Street No. 8, Mahipalpur Extn., New Delhi - 110037, India',
  gstin: '07AAACC6689E1ZJ',
  phone: '011-46151111',
  email: 'contact@committedcargo.com',
  city: 'NEW DELHI',
};

const COMPANY_PROFILE_SQL =
  'SELECT companyName, legalName, address1, address2, city, state, pincode, country, gstin, phone, email ' +
  'FROM CompanyProfile ORDER BY id LIMIT 1';
const DEFAULT_BRANCH_SQL =
  'SELECT id, branchCode, branchName, address, gstin, phone, email FROM CompanyBranches ' +
  "WHERE coalesce(status, 'Active') <> 'Inactive' ORDER BY isDefault DESC, id LIMIT 1";
const BRANCH_BY_ID_SQL =
  'SELECT id, branchCode, branchName, address, gstin, phone, email FROM CompanyBranches WHERE id = ?';

async function selectFirstRow(sql, replacements = []) {
  const rows = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT }).catch(() => []);
  return rows[0] || null;
}

const text = (value) => (value == null ? '' : String(value).trim());

export async function ourCompany(branchId) {
  const profile = (await selectFirstRow(COMPANY_PROFILE_SQL)) || {};
  const defaultBranch = await selectFirstRow(DEFAULT_BRANCH_SQL);
  const pickedBranch = branchId ? await selectFirstRow(BRANCH_BY_ID_SQL, [branchId]) : null;
  const branch = pickedBranch || defaultBranch || {};
  const isHeadOffice = !defaultBranch || !branch.id || branch.id === defaultBranch.id;
  const profileAddress = [
    profile.address1,
    profile.address2,
    profile.city,
    profile.state,
    profile.pincode,
    profile.country,
  ]
    .map(text)
    .filter(Boolean)
    .join(', ');
  const headOfficeValue = (profileValue, fallback) => (isHeadOffice ? profileValue || fallback : '');

  return {
    name: text(profile.companyName) || text(profile.legalName) || HEAD_OFFICE_DEFAULT.name,
    address: text(branch.address) || headOfficeValue(profileAddress, HEAD_OFFICE_DEFAULT.address),
    gstin: text(branch.gstin) || headOfficeValue(text(profile.gstin), HEAD_OFFICE_DEFAULT.gstin),
    phone: text(branch.phone) || headOfficeValue(text(profile.phone), HEAD_OFFICE_DEFAULT.phone),
    email: text(branch.email) || headOfficeValue(text(profile.email), HEAD_OFFICE_DEFAULT.email),
    branch: text(branch.branchName),
    city: text(profile.city) || (isHeadOffice ? HEAD_OFFICE_DEFAULT.city : text(branch.branchName)),
  };
}
