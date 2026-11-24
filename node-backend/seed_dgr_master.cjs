const { sequelize } = require('./db');
const IataDgrMaster = require('./models/IataDgrMaster');

const dgrData = [
  // Class 1: Explosives (Very rarely flown, usually CAO or forbidden)
  { unNumber: 'UN0012', properShippingName: 'Cartridges for weapons, inert projectile', classDivision: '1.4S', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN0336', properShippingName: 'Fireworks', classDivision: '1.4G', packingGroup: 'N/A', caoOnly: 'Yes (Strict)' },
  
  // Class 2: Gases
  { unNumber: 'UN1001', properShippingName: 'Acetylene, dissolved', classDivision: '2.1', packingGroup: 'N/A', caoOnly: 'Yes' },
  { unNumber: 'UN1066', properShippingName: 'Nitrogen, compressed', classDivision: '2.2', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN1072', properShippingName: 'Oxygen, compressed', classDivision: '2.2 (5.1)', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN1073', properShippingName: 'Oxygen, refrigerated liquid', classDivision: '2.2 (5.1)', packingGroup: 'N/A', caoOnly: 'Forbidden' },
  { unNumber: 'UN1950', properShippingName: 'Aerosols, flammable', classDivision: '2.1', packingGroup: 'N/A', caoOnly: 'Yes (Depending on capacity)' },
  { unNumber: 'UN1950', properShippingName: 'Aerosols, non-flammable', classDivision: '2.2', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN2037', properShippingName: 'Receptacles, small, containing gas', classDivision: '2.1', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN3150', properShippingName: 'Devices, small, hydrocarbon gas powered', classDivision: '2.1', packingGroup: 'N/A', caoOnly: 'No' },

  // Class 3: Flammable Liquids
  { unNumber: 'UN1090', properShippingName: 'Acetone', classDivision: '3', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN1133', properShippingName: 'Adhesives containing flammable liquid', classDivision: '3', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN1170', properShippingName: 'Ethanol solution', classDivision: '3', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN1203', properShippingName: 'Motor spirit or Gasoline or Petrol', classDivision: '3', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN1219', properShippingName: 'Isopropanol (Isopropyl alcohol)', classDivision: '3', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN1230', properShippingName: 'Methanol', classDivision: '3 (6.1)', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN1263', properShippingName: 'Paint', classDivision: '3', packingGroup: 'I', caoOnly: 'Yes' },
  { unNumber: 'UN1263', properShippingName: 'Paint', classDivision: '3', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN1266', properShippingName: 'Perfumery products with flammable solvents', classDivision: '3', packingGroup: 'II', caoOnly: 'No' },

  // Class 4: Flammable Solids
  { unNumber: 'UN1325', properShippingName: 'Flammable solid, organic, n.o.s.', classDivision: '4.1', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN1361', properShippingName: 'Carbon, animal or vegetable origin', classDivision: '4.2', packingGroup: 'III', caoOnly: 'No' },
  { unNumber: 'UN1395', properShippingName: 'Aluminum ferrosilicon powder', classDivision: '4.3 (6.1)', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN3174', properShippingName: 'Titanium disulfide', classDivision: '4.2', packingGroup: 'III', caoOnly: 'No' },

  // Class 5: Oxidizing Substances and Organic Peroxides
  { unNumber: 'UN1444', properShippingName: 'Ammonium persulfate', classDivision: '5.1', packingGroup: 'III', caoOnly: 'No' },
  { unNumber: 'UN1479', properShippingName: 'Oxidizing solid, n.o.s.', classDivision: '5.1', packingGroup: 'I', caoOnly: 'Yes' },
  { unNumber: 'UN1486', properShippingName: 'Potassium nitrate', classDivision: '5.1', packingGroup: 'III', caoOnly: 'No' },
  { unNumber: 'UN3101', properShippingName: 'Organic peroxide type B, liquid', classDivision: '5.2', packingGroup: 'N/A', caoOnly: 'Forbidden' },
  { unNumber: 'UN3105', properShippingName: 'Organic peroxide type D, liquid', classDivision: '5.2', packingGroup: 'N/A', caoOnly: 'No' },

  // Class 6: Toxic and Infectious Substances
  { unNumber: 'UN1544', properShippingName: 'Alkaloids, solid, n.o.s. (poisonous)', classDivision: '6.1', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN1671', properShippingName: 'Phenol, solid', classDivision: '6.1', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN2814', properShippingName: 'Infectious substance, affecting humans', classDivision: '6.2', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN2900', properShippingName: 'Infectious substance, affecting animals only', classDivision: '6.2', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN3291', properShippingName: 'Clinical waste, unspecified, n.o.s.', classDivision: '6.2', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN3373', properShippingName: 'Biological substance, Category B', classDivision: '6.2', packingGroup: 'N/A', caoOnly: 'No' },

  // Class 7: Radioactive Material
  { unNumber: 'UN2910', properShippingName: 'Radioactive material, excepted package', classDivision: '7', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN2911', properShippingName: 'Radioactive material, excepted package - instruments or articles', classDivision: '7', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN2915', properShippingName: 'Radioactive material, Type A package', classDivision: '7', packingGroup: 'N/A', caoOnly: 'No' },

  // Class 8: Corrosives
  { unNumber: 'UN1759', properShippingName: 'Corrosive solid, n.o.s.', classDivision: '8', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN1789', properShippingName: 'Hydrochloric acid', classDivision: '8', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN1823', properShippingName: 'Sodium hydroxide, solid', classDivision: '8', packingGroup: 'II', caoOnly: 'No' },
  { unNumber: 'UN2794', properShippingName: 'Batteries, wet, filled with acid', classDivision: '8', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN2795', properShippingName: 'Batteries, wet, filled with alkali', classDivision: '8', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN2800', properShippingName: 'Batteries, wet, non-spillable', classDivision: '8', packingGroup: 'N/A', caoOnly: 'No' },

  // Class 9: Miscellaneous Dangerous Goods (Including Lithium Batteries & Dry Ice)
  { unNumber: 'UN1845', properShippingName: 'Dry Ice (Carbon dioxide, solid)', classDivision: '9', packingGroup: 'III', caoOnly: 'No' },
  { unNumber: 'UN3077', properShippingName: 'Environmentally hazardous substance, solid, n.o.s.', classDivision: '9', packingGroup: 'III', caoOnly: 'No' },
  { unNumber: 'UN3082', properShippingName: 'Environmentally hazardous substance, liquid, n.o.s.', classDivision: '9', packingGroup: 'III', caoOnly: 'No' },
  { unNumber: 'UN3090', properShippingName: 'Lithium metal batteries', classDivision: '9', packingGroup: 'N/A', caoOnly: 'Yes (PI 968)' },
  { unNumber: 'UN3091', properShippingName: 'Lithium metal batteries contained in equipment', classDivision: '9', packingGroup: 'N/A', caoOnly: 'No (PI 970)' },
  { unNumber: 'UN3091', properShippingName: 'Lithium metal batteries packed with equipment', classDivision: '9', packingGroup: 'N/A', caoOnly: 'No (PI 969)' },
  { unNumber: 'UN3166', properShippingName: 'Vehicle, flammable gas powered', classDivision: '9', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN3171', properShippingName: 'Battery-powered vehicle / equipment', classDivision: '9', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN3334', properShippingName: 'Aviation regulated liquid, n.o.s.', classDivision: '9', packingGroup: 'III', caoOnly: 'No' },
  { unNumber: 'UN3363', properShippingName: 'Dangerous Goods in Machinery/Apparatus', classDivision: '9', packingGroup: 'N/A', caoOnly: 'No' },
  { unNumber: 'UN3480', properShippingName: 'Lithium Ion Batteries', classDivision: '9', packingGroup: 'N/A', caoOnly: 'Yes (PI 965)' },
  { unNumber: 'UN3481', properShippingName: 'Lithium ion batteries contained in equipment', classDivision: '9', packingGroup: 'N/A', caoOnly: 'No (PI 967)' },
  { unNumber: 'UN3481', properShippingName: 'Lithium ion batteries packed with equipment', classDivision: '9', packingGroup: 'N/A', caoOnly: 'No (PI 966)' }
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('DB connected.');
    
    // Clear old sample data
    await IataDgrMaster.destroy({ where: {} });
    console.log('Old DGR data cleared.');

    // Insert new comprehensive data
    await IataDgrMaster.bulkCreate(dgrData);
    console.log(`Successfully seeded ${dgrData.length} comprehensive IATA DGR Master records!`);
    
  } catch(e) {
    console.error('Error seeding DGR:', e);
  } finally {
    process.exit();
  }
}

seed();
