const { sequelize } = require('./db');
const TactCountryRule = require('./models/TactCountryRule');

const countryRules = [
  // US & Canada
  { countryCode: 'CA', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'eManifest (ACI) mandatory 4 hours prior to arrival.', isBlocking: true },
  { countryCode: 'CA', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'Wood packaging must comply with ISPM 15 standards.', isBlocking: true },
  { countryCode: 'CA', ruleType: 'TRANSIT', ruleCategory: 'CUSTOMS', description: 'In-bond transit requires CBSA carrier code.', isBlocking: true },
  { countryCode: 'US', ruleType: 'IMPORT', ruleCategory: 'CUSTOMS', description: 'FDA Prior Notice required for all food and beverage imports.', isBlocking: true },
  { countryCode: 'US', ruleType: 'EXPORT', ruleCategory: 'DOCS', description: 'AES ITN (Internal Transaction Number) required for shipments > $2500.', isBlocking: true },
  { countryCode: 'MX', ruleType: 'IMPORT', ruleCategory: 'OCI', description: 'Consignee RFC (Tax ID) mandatory in OCI.', isBlocking: true },

  // Europe (Non-EU & EU Specifics)
  { countryCode: 'CH', ruleType: 'IMPORT', ruleCategory: 'CUSTOMS', description: 'Swiss customs requires exact weight in KGs up to 3 decimal places.', isBlocking: false },
  { countryCode: 'TR', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'ATR Certificate required for preferential duty rates from EU.', isBlocking: false },
  { countryCode: 'TR', ruleType: 'IMPORT', ruleCategory: 'OCI', description: 'Consignee VAT number mandatory for all commercial shipments.', isBlocking: true },
  { countryCode: 'GB', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'Products of animal origin require pre-notification on IPAFFS.', isBlocking: true },
  { countryCode: 'RU', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'Complete embargo on dual-use technology and defense items.', isBlocking: true },
  { countryCode: 'RU', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'Original commercial invoice required with blue ink stamp.', isBlocking: true },
  { countryCode: 'DE', ruleType: 'IMPORT', ruleCategory: 'CUSTOMS', description: 'ATLAS electronic customs declaration mandatory.', isBlocking: true },
  
  // Asia Pacific
  { countryCode: 'JP', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'NACCS Advance Filing Rules (AFR) mandatory 24h before departure.', isBlocking: true },
  { countryCode: 'JP', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'Strict quarantine on fresh fruits, meat, and plants.', isBlocking: true },
  { countryCode: 'KR', ruleType: 'IMPORT', ruleCategory: 'OCI', description: 'Consignee Business Registration Number required.', isBlocking: true },
  { countryCode: 'KR', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'KC (Korea Certification) mark required for electronics.', isBlocking: true },
  { countryCode: 'SG', ruleType: 'IMPORT', ruleCategory: 'CUSTOMS', description: 'TradeNet declaration required for all controlled goods.', isBlocking: true },
  { countryCode: 'AU', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'DAFF strict biosecurity checks. All timber must be fumigated.', isBlocking: true },
  { countryCode: 'AU', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'Asbestos strictly prohibited. Zero tolerance policy.', isBlocking: true },
  { countryCode: 'NZ', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'MPI biosecurity clearance mandatory for food and biologicals.', isBlocking: true },
  { countryCode: 'CN', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'Cosmetics require NMPA pre-market approval.', isBlocking: true },
  { countryCode: 'CN', ruleType: 'EXPORT', ruleCategory: 'DOCS', description: 'Export License mandatory for restricted technology items.', isBlocking: true },
  { countryCode: 'IN', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'BIS certification mandatory for electronics and steel.', isBlocking: true },
  { countryCode: 'IN', ruleType: 'EXPORT', ruleCategory: 'DOCS', description: 'Shipping Bill (Let Export Order) mandatory before uplift.', isBlocking: true },
  
  // Middle East & Africa
  { countryCode: 'QA', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'Legalized Certificate of Origin by Qatar Embassy required.', isBlocking: true },
  { countryCode: 'QA', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'Alcohol and pork products strictly prohibited.', isBlocking: true },
  { countryCode: 'SA', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'SABER platform registration and SASO certificate mandatory.', isBlocking: true },
  { countryCode: 'AE', ruleType: 'IMPORT', ruleCategory: 'CUSTOMS', description: 'Dubai Customs Mirsal 2 declaration required.', isBlocking: true },
  { countryCode: 'ZA', ruleType: 'IMPORT', ruleCategory: 'OCI', description: 'Consignee Customs Code mandatory in OCI.', isBlocking: true },
  { countryCode: 'ZA', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'Used clothing imports require ITAC permit.', isBlocking: true },
  { countryCode: 'EG', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'ACID (Advance Cargo Information Declaration) number mandatory.', isBlocking: true },
  { countryCode: 'EG', ruleType: 'IMPORT', ruleCategory: 'OCI', description: 'ACID number must be printed on the Master AWB.', isBlocking: true },
  { countryCode: 'NG', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'SONCAP certificate required for regulated products.', isBlocking: true },
  { countryCode: 'KE', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'PVOC (Pre-Export Verification of Conformity) certificate required.', isBlocking: true },
  
  // Latin America
  { countryCode: 'BR', ruleType: 'IMPORT', ruleCategory: 'OCI', description: 'Consignee CNPJ (Company Tax ID) strictly mandatory.', isBlocking: true },
  { countryCode: 'BR', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'Original AWB and Commercial Invoice with blue ink signature.', isBlocking: true },
  { countryCode: 'BR', ruleType: 'IMPORT', ruleCategory: 'RESTRICTION', description: 'ANVISA approval required for medical/pharma goods.', isBlocking: true },
  { countryCode: 'AR', ruleType: 'IMPORT', ruleCategory: 'OCI', description: 'Consignee CUIT number mandatory.', isBlocking: true },
  { countryCode: 'CL', ruleType: 'IMPORT', ruleCategory: 'CUSTOMS', description: 'Consignee RUT number required for customs clearance.', isBlocking: true },
  { countryCode: 'CO', ruleType: 'IMPORT', ruleCategory: 'DOCS', description: 'Commercial invoice must be in Spanish.', isBlocking: false }
];

async function seed() {
  try {
    await sequelize.authenticate();
    await TactCountryRule.bulkCreate(countryRules, { ignoreDuplicates: true });
    const count = await TactCountryRule.count();
    console.log(`Successfully added more country rules! Total is now: ${count}`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

seed();
