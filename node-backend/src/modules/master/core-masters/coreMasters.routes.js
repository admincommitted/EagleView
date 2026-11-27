import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import { createParty } from '../party/party.controller.js';
import { createPartySchema, partyFormErrorBody } from '../party/party.validation.js';
import { joinedMessagesAnswer, recordErrorAnswer, routeHandler } from '../shared/errorAnswers.js';
import {
  createCategoryItem,
  deleteCategoryItem,
  listCategory,
  seedMasters,
  updateCategoryItem,
} from './coreMasters.controller.js';

const router = Router();

router.get('/:category', routeHandler(listCategory));
router.post('/seed', routeHandler(seedMasters));
// the Party Master form; must come before POST /:category
router.post(
  '/parties',
  validate({ body: createPartySchema }, { errorBody: partyFormErrorBody }),
  routeHandler(createParty, joinedMessagesAnswer(400)),
);
router.post('/:category', routeHandler(createCategoryItem, recordErrorAnswer()));
router.put('/:category/:id', routeHandler(updateCategoryItem, recordErrorAnswer()));
router.delete('/:category/:id', routeHandler(deleteCategoryItem, recordErrorAnswer(500)));

export default router;
