import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import {
  costCentreChoices,
  financialYearChoices,
  groupChoices,
  ledgerChoices,
  sacChoices,
  tdsNatureChoices,
} from './lookups.controller.js';

const router = Router();

// optional lists: a table that is not there yet gives an empty list
const EMPTY_LIST_ON_ERROR = { onError: (res) => res.json([]) };

router.get('/lookups/ledgers', handleHubRoute(ledgerChoices));
router.get('/lookups/groups', handleHubRoute(groupChoices));
router.get('/lookups/tdsnatures', handleHubRoute(tdsNatureChoices, EMPTY_LIST_ON_ERROR));
router.get('/lookups/costcentres', handleHubRoute(costCentreChoices, EMPTY_LIST_ON_ERROR));
router.get('/lookups/sac', handleHubRoute(sacChoices, EMPTY_LIST_ON_ERROR));
router.get('/lookups/years', handleHubRoute(financialYearChoices, EMPTY_LIST_ON_ERROR));

export default router;
