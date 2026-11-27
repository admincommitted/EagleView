import { Godown, InventoryCategory, InventoryGroup, StockItem, UnitOfMeasure } from '../../../models/index.js';

/** Nests the records under their parent (parentId), starting from the top level. */
function buildTree(records, parentId = null) {
  return records
    .filter((record) => record.parentId === parentId)
    .map((record) => ({ ...record.dataValues, children: buildTree(records, record.id) }));
}

/** Every inventory master, as flat lists and (groups, categories, godowns) as trees. */
export async function listAllMasters() {
  const groups = await InventoryGroup.findAll();
  const categories = await InventoryCategory.findAll();
  const uoms = await UnitOfMeasure.findAll();
  const godowns = await Godown.findAll();
  const items = await StockItem.findAll();
  return {
    success: true,
    data: {
      groupsTree: buildTree(groups),
      groupsFlat: groups,
      categoriesTree: buildTree(categories),
      categoriesFlat: categories,
      uoms,
      godownsTree: buildTree(godowns),
      godownsFlat: godowns,
      items,
    },
  };
}

export const createGroup = (fields) => InventoryGroup.create(fields);
export const createCategory = (fields) => InventoryCategory.create(fields);
export const createUnitOfMeasure = (fields) => UnitOfMeasure.create(fields);
export const createGodown = (fields) => Godown.create(fields);
export const createStockItem = (fields) => StockItem.create(fields);
