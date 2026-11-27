import { BadRequestError, ConflictError, NotFoundError } from '../../../../core/http/index.js';
import { PurchaseOrder, Vendor } from '../../../../models/index.js';

const GST_NUMBER_RE = /^[0-9]{2}[A-Z0-9]{13}$/;

const errorBody = (message) => ({ body: { error: message } });

/** Only the five vendor fields are taken from the form. */
function vendorFields(body) {
  const text = (value) => String(value == null ? '' : value).trim();
  return {
    vendorName: text(body.vendorName),
    gstNumber: text(body.gstNumber).toUpperCase(),
    contactEmail: text(body.contactEmail),
    phone: text(body.phone),
    address: text(body.address),
  };
}

// a blank name or a name another vendor already has is refused
async function vendorProblem(fields, exceptId) {
  if (!fields.vendorName) return 'Vendor name is required';
  if (fields.gstNumber && !GST_NUMBER_RE.test(fields.gstNumber)) {
    return 'GST number must be 15 characters (2 digits, then 13 letters / digits)';
  }
  const vendors = await Vendor.findAll({ attributes: ['id', 'vendorName'] });
  const twin = vendors.find(
    (vendor) =>
      String(vendor.id) !== String(exceptId || '') &&
      String(vendor.vendorName || '')
        .trim()
        .toUpperCase() === fields.vendorName.toUpperCase(),
  );
  return twin ? 'A vendor named ' + twin.vendorName + ' is already there' : '';
}

async function assertVendorIsValid(fields, exceptId) {
  const problem = await vendorProblem(fields, exceptId);
  if (problem) throw new BadRequestError(problem, errorBody(problem));
}

async function findVendor(vendorId) {
  const vendor = await Vendor.findByPk(vendorId);
  if (!vendor) throw new NotFoundError('Vendor not found', errorBody('Vendor not found'));
  return vendor;
}

export const listVendors = () => Vendor.findAll();

export async function createVendor(body) {
  const fields = vendorFields(body || {});
  await assertVendorIsValid(fields, null);
  return Vendor.create(fields);
}

export async function updateVendor(vendorId, body) {
  const vendor = await findVendor(vendorId);
  const fields = vendorFields(body || {});
  await assertVendorIsValid(fields, vendor.id);
  await vendor.update(fields);
  return vendor;
}

/** A vendor that a purchase order uses cannot be deleted. */
export async function deleteVendor(vendorId) {
  const vendor = await findVendor(vendorId);
  const ordersUsingIt = await PurchaseOrder.count({ where: { VendorID: vendor.id } });
  if (ordersUsingIt) {
    const message = vendor.vendorName + ' is used in ' + ordersUsingIt + ' purchase order(s) - it cannot be deleted';
    throw new ConflictError(message, errorBody(message));
  }
  await vendor.destroy();
  return { success: true };
}
