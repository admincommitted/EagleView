const { sequelize } = require('./db');
const TactCountryRule = require('./models/TactCountryRule');

// A large list of major country codes
const countries = [
  'AF','AL','DZ','AS','AD','AO','AR','AM','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BA','BW','BR','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CN','CO','KM','CG','CD','CR','CI','HR','CU','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI','FR','GA','GM','GE','DE','GH','GR','GD','GU','GT','GN','GW','GY','HT','HN','HK','HU','IS','IN','ID','IR','IQ','IE','IL','IT','JM','JP','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MO','MG','MW','MY','MV','ML','MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM','NA','NR','NP','NL','NZ','NI','NE','NG','MK','NO','OM','PK','PW','PA','PG','PY','PE','PH','PL','PT','PR','QA','RO','RU','RW','KN','LC','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SK','SI','SB','SO','ZA','SS','ES','LK','SD','SR','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TO','TT','TN','TR','TM','TV','UG','UA','AE','GB','US','UY','UZ','VU','VE','VN','YE','ZM','ZW'
];

const generatedRules = [];

countries.forEach(cc => {
  // Add 1-4 standard rules per country
  generatedRules.push({
    countryCode: cc,
    ruleType: 'IMPORT',
    category: 'DOCS',
    description: `Original Commercial Invoice (minimum 3 copies) required for customs clearance in ${cc}.`,
    isBlocking: true
  });
  
  generatedRules.push({
    countryCode: cc,
    ruleType: 'IMPORT',
    category: 'RESTRICTION',
    description: 'Dangerous Goods (Lithium Batteries UN3480) strictly prohibited on passenger aircraft.',
    isBlocking: true
  });
  
  // Randomly add some OCI or Export rules
  if (Math.random() > 0.5) {
    generatedRules.push({
      countryCode: cc,
      ruleType: 'IMPORT',
      category: 'OCI',
      description: 'Consignee Tax ID / Business Registration number mandatory in OCI string.',
      isBlocking: true
    });
  }
  
  if (Math.random() > 0.7) {
    generatedRules.push({
      countryCode: cc,
      ruleType: 'EXPORT',
      category: 'DOCS',
      description: `Export customs declaration (Let Export) mandatory before uplift from ${cc}.`,
      isBlocking: true
    });
  }
});

async function seed() {
  try {
    await sequelize.authenticate();
    await TactCountryRule.bulkCreate(generatedRules, { ignoreDuplicates: true });
    const count = await TactCountryRule.count();
    console.log(`Successfully generated massive country rules! Total is now: ${count}`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

seed();
