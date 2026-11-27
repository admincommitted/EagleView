import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import { routeHandler } from '../shared/errorAnswers.js';
import {
  countriesWithStates,
  createCity,
  createState,
  deleteCity,
  deleteState,
  foreignPorts,
  listAirports,
  listCities,
  listStates,
  locationStats,
  nestedLocations,
  updateCity,
  updateState,
} from './location.controller.js';
import { citySchema, locationErrorBody, stateSchema } from './location.validation.js';

const UNIQUE_ERROR = 'SequelizeUniqueConstraintError';

/** A failed state / city save: 409 for a duplicate, else 400, with every Sequelize message joined. */
const locationSaveErrorAnswer = (error) => ({
  status: error.name === UNIQUE_ERROR ? 409 : 400,
  body: { error: error.errors ? error.errors.map((item) => item.message).join(', ') : error.message },
});

const checkState = validate({ body: stateSchema }, { errorBody: locationErrorBody });
const checkCity = validate({ body: citySchema }, { errorBody: locationErrorBody });

/** /api/locations */
const router = Router();

router.get('/foreign-ports', foreignPorts);
router.get('/lite', routeHandler(countriesWithStates));
router.get('/stats', routeHandler(locationStats));
router.get('/', routeHandler(nestedLocations));
router.get('/states', routeHandler(listStates));
router.get('/airports', routeHandler(listAirports));
router.get('/cities', routeHandler(listCities));
router.post('/states', checkState, routeHandler(createState, locationSaveErrorAnswer));
router.put('/states/:id', checkState, routeHandler(updateState, locationSaveErrorAnswer));
router.delete('/states/:id', routeHandler(deleteState));
router.post('/cities', checkCity, routeHandler(createCity, locationSaveErrorAnswer));
router.put('/cities/:id', checkCity, routeHandler(updateCity, locationSaveErrorAnswer));
router.delete('/cities/:id', routeHandler(deleteCity));

export default router;
