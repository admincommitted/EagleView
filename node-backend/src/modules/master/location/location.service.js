import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { NotFoundError } from '../../../core/http/index.js';
import { City, Country, State } from '../../../models/index.js';

const BLANK_TO_NULL_TYPES = ['INTEGER', 'FLOAT', 'DECIMAL', 'DOUBLE', 'DATE', 'DATEONLY'];
const MIN_CITY_SEARCH_LENGTH = 2;
const DEFAULT_CITY_LIMIT = 50;
const MAX_CITY_LIMIT = 200;
const CITY_SEARCH_ATTRIBUTES = ['id', 'cityName', 'stateId', 'countryId', 'iataCode', 'unlocCode'];
const NO_IATA_CODE = '-';

const failed = (ErrorClass, message) => new ErrorClass(message, { body: { error: message } });

// foreign port codes (UN/LOCODE, 45,000+ rows) read once and kept as the ready JSON text
let foreignPortsJson = null;

/** A state / city from the form: a "new" id '' is dropped (SQLite refuses it), '' in a number / date column is null. */
function cleanLocation(Model, body) {
  const cleaned = { ...body };
  if (cleaned.id === '' || cleaned.id == null) delete cleaned.id;
  delete cleaned.createdAt;
  delete cleaned.updatedAt;
  delete cleaned.cities;
  delete cleaned.states;
  for (const [name, attribute] of Object.entries(Model.rawAttributes)) {
    if (cleaned[name] === '' && attribute.type && BLANK_TO_NULL_TYPES.includes(attribute.type.key))
      cleaned[name] = null;
  }
  return cleaned;
}

const upperIataCode = (city) => {
  if (city.iataCode) city.iataCode = String(city.iataCode).trim().toUpperCase();
  return city;
};

/** [[code, name, countryCode], ...] as JSON text; throws when the ForeignPorts table is not loaded yet. */
export async function foreignPortsList() {
  if (!foreignPortsJson) {
    const rows = await sequelize.query(
      'SELECT code, name, countryCode FROM ForeignPorts WHERE isActive = 1 ORDER BY code',
      { type: QueryTypes.SELECT },
    );
    foreignPortsJson = JSON.stringify(rows.map((row) => [row.code, row.name, row.countryCode]));
  }
  return foreignPortsJson;
}

export const countriesWithStates = () =>
  Country.findAll({
    include: [{ model: State, as: 'states', attributes: ['id', 'stateName', 'stateCode', 'taxCode'] }],
    attributes: ['id', 'code', 'name'],
    order: [['name', 'ASC']],
  });

export async function locationStats() {
  const countries = await Country.count();
  const states = await State.count();
  const cities = await City.count();
  const airports = await City.count({
    where: { iataCode: { [Op.and]: [{ [Op.not]: null }, { [Op.ne]: NO_IATA_CODE }] } },
  });
  return { countries, states, cities, airports };
}

/** Countries > states > cities; cities without an IATA code (NULL) are included. */
export const nestedLocations = () =>
  Country.findAll({
    include: [
      {
        model: State,
        as: 'states',
        include: [
          {
            model: City,
            as: 'cities',
            where: { [Op.or]: [{ iataCode: null }, { iataCode: { [Op.ne]: NO_IATA_CODE } }] },
            required: false,
          },
        ],
      },
    ],
    order: [['name', 'ASC']],
  });

export const listStates = () => State.findAll();

export const listAirports = () =>
  sequelize.query(
    `
            SELECT c.id, c."cityName", c."airportName", c."iataCode", c."countryId",
                   co.code as "countryCode"
            FROM "Cities" c
            LEFT JOIN "Countries" co ON c."countryId" = co.id
            WHERE c."iataCode" IS NOT NULL AND c."iataCode" != '-'
        `,
    { type: QueryTypes.SELECT },
  );

/**
 * ?q= searches the city name (names starting with the text first, then containing it; at most ?limit=). Without q the
 * whole list (about 1,50,000 cities) is returned for the master screens.
 */
export async function listCities({ q, limit }) {
  if (q === undefined) return City.findAll();
  const text = String(q || '').trim();
  const maxRows = Math.min(MAX_CITY_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_CITY_LIMIT));
  if (text.length < MIN_CITY_SEARCH_LENGTH) return [];
  const startingWith = await City.findAll({
    where: { cityName: { [Op.like]: `${text}%` } },
    attributes: CITY_SEARCH_ATTRIBUTES,
    order: [['cityName', 'ASC']],
    limit: maxRows,
  });
  if (startingWith.length >= maxRows) return startingWith;
  const containing = await City.findAll({
    where: { cityName: { [Op.like]: `%${text}%`, [Op.notLike]: `${text}%` } },
    attributes: CITY_SEARCH_ATTRIBUTES,
    order: [['cityName', 'ASC']],
    limit: maxRows - startingWith.length,
  });
  return startingWith.concat(containing);
}

export const createState = (body) => State.create(cleanLocation(State, body));

export async function updateState(id, body) {
  const changes = cleanLocation(State, body);
  delete changes.id;
  await State.update(changes, { where: { id } });
  const state = await State.findByPk(id);
  if (!state) throw failed(NotFoundError, 'State not found');
  return state;
}

/** A state goes with its cities; answers how many cities were deleted. */
export async function deleteState(id) {
  let citiesDeleted = 0;
  await sequelize.transaction(async (transaction) => {
    citiesDeleted = await City.destroy({ where: { stateId: id }, transaction });
    await State.destroy({ where: { id }, transaction });
  });
  return citiesDeleted;
}

export const createCity = (body) => City.create(upperIataCode(cleanLocation(City, body)));

export async function updateCity(id, body) {
  const changes = upperIataCode(cleanLocation(City, body));
  delete changes.id;
  await City.update(changes, { where: { id } });
  const city = await City.findByPk(id);
  if (!city) throw failed(NotFoundError, 'City not found');
  return city;
}

export const deleteCity = (id) => City.destroy({ where: { id } });
