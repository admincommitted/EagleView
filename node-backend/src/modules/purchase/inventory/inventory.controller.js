import { ApiResponse } from '../../../core/http/index.js';
import * as inventoryService from './inventory.service.js';

const HTTP_BAD_REQUEST = 400;

export async function listAllMasters(req, res) {
  ApiResponse.send(res, await inventoryService.listAllMasters());
}

// a master that cannot be saved (missing / wrong field, duplicate) answers 400 with the database's message
const createdFrom = (createMaster) => async (req, res) => {
  try {
    const record = await createMaster(req.body);
    ApiResponse.send(res, { success: true, data: record });
  } catch (error) {
    ApiResponse.send(res, { error: error.message }, HTTP_BAD_REQUEST);
  }
};

export const createGroup = createdFrom(inventoryService.createGroup);
export const createCategory = createdFrom(inventoryService.createCategory);
export const createUnitOfMeasure = createdFrom(inventoryService.createUnitOfMeasure);
export const createGodown = createdFrom(inventoryService.createGodown);
export const createStockItem = createdFrom(inventoryService.createStockItem);
