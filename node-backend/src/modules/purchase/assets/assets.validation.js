import { z } from 'zod';

// any body is taken as it is; only the asset name is required
export const createAssetSchema = z.any().refine((body) => !!(body && body.assetName), { message: 'assetName is required' });
