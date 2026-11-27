import { Router } from 'express';
import multer from 'multer';
import { failedErrorAnswer, routeHandler } from '../shared/errorAnswers.js';
import {
  listCarrierRules,
  listCountryRules,
  listDgr,
  listEquipmentRules,
  listExchangeRates,
  listProportionalRates,
  listRateSectors,
  listShcConflicts,
  listSurcharges,
  quoteRate,
  uploadCsv,
} from './tact.controller.js';

const MAX_CSV_BYTES = 5 * 1024 * 1024;

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_CSV_BYTES } });

/** /api/tact */
const router = Router();

router.get('/country-rules', routeHandler(listCountryRules));
router.get('/carrier-rules', routeHandler(listCarrierRules));
router.get('/equipment', routeHandler(listEquipmentRules));
router.get('/dgr', routeHandler(listDgr));
router.get('/surcharges', routeHandler(listSurcharges));
router.get('/exchange-rates', routeHandler(listExchangeRates));
router.get('/shc-conflicts', routeHandler(listShcConflicts));
router.get('/proportional-rates', routeHandler(listProportionalRates));
router.get('/rates', routeHandler(listRateSectors));
router.post('/upload/:type', csvUpload.single('file'), routeHandler(uploadCsv));
router.get('/quote', routeHandler(quoteRate, failedErrorAnswer));

export default router;
