import { Op } from 'sequelize';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { Asset } from '../../../models/index.js';

const EDITABLE_FIELDS = [
  'assetName', 'description', 'status', 'assignedTo', 'assignedDepartment', 'branch', 'category', 'assetTag', 'purchaseValue',
  'sourcePurchaseId', 'warrantyExpiryDate',
];
const DEFAULT_ALERT_DAYS = 30;
const MAX_ALERT_DAYS = 365;
const ALERT_LIMIT = 50;
const ONE_DAY_MS = 86400000;

const errorBody = (message) => ({ body: { error: message } });

/** The editable fields the form sent ('' saved as null). */
const editableFields = (body) => Object.fromEntries(
  EDITABLE_FIELDS.filter((key) => body[key] !== undefined).map((key) => [key, body[key] === '' ? null : body[key]]),
);

async function findAsset(assetId) {
  const asset = await Asset.findByPk(assetId);
  if (!asset) throw new NotFoundError('Asset not found', errorBody('Asset not found'));
  return asset;
}

export const listAssets = () => Asset.findAll({ order: [['createdAt', 'DESC']] });

/** Warranties expired or expiring within the next N days (1 to 365, default 30). */
export function listExpiringWarranties(daysValue) {
  const days = Math.min(Math.max(parseInt(daysValue, 10) || DEFAULT_ALERT_DAYS, 1), MAX_ALERT_DAYS);
  const until = new Date(Date.now() + days * ONE_DAY_MS).toISOString().slice(0, 10);
  return Asset.findAll({
    where: { warrantyExpiryDate: { [Op.ne]: null, [Op.lte]: until }, status: { [Op.ne]: 'DISCARDED' } },
    order: [['warrantyExpiryDate', 'ASC']],
    limit: ALERT_LIMIT,
  });
}

/** A new asset; without a tag it gets AST-00001 from its id. */
export async function createAsset(body) {
  const asset = await Asset.create(editableFields(body || {}));
  if (!asset.assetTag) await asset.update({ assetTag: 'AST-' + String(asset.id).padStart(5, '0') });
  return asset;
}

export async function updateAsset(assetId, body) {
  const asset = await findAsset(assetId);
  await asset.update(editableFields(body || {}));
  return asset;
}

/** Discards the asset (with the reason and an optional photo) and frees it from whoever had it. */
export async function discardAsset(assetId, body, photoUrl) {
  const asset = await findAsset(assetId);
  if (!body || !body.reason) throw new BadRequestError('reason is required', errorBody('reason is required'));
  await asset.update({
    status: 'DISCARDED',
    discardReason: body.reason,
    discardPhotoUrl: photoUrl || asset.discardPhotoUrl,
    assignedTo: null,
    assignedDepartment: null,
  });
  return asset;
}

/** Saves an uploaded file's URL in one of the asset's file columns (billUrl / photoUrl). */
export async function attachAssetFile(assetId, column, fileUrl) {
  const asset = await findAsset(assetId);
  if (!fileUrl) throw new BadRequestError('Image or PDF file is required', errorBody('Image or PDF file is required'));
  await asset.update({ [column]: fileUrl });
  return asset;
}
