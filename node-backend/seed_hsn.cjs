const { sequelize } = require('./db');
const TariffHeader = require('./models/TariffHeader');

async function seedHsn() {
    await sequelize.sync();
    
    const hsnData = [
        { hsnCode: '57011010', description: 'Hand-made carpets and other textile floor coverings of wool or fine animal hair', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '57011090', description: 'Other carpets and other textile floor coverings of wool or fine animal hair', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '57019011', description: 'Hand-made carpets of silk', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '57019019', description: 'Other carpets of silk', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '57019020', description: 'Carpets of coir including geo textile', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '57019031', description: 'Hand-made carpets of synthetic fibres', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '57019039', description: 'Other carpets of synthetic fibres', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '57019090', description: 'Other carpets of other textile materials', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '57021000', description: '"Kelem", "Schumacks", "Karamanie" and similar hand-woven rugs', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '57022010', description: 'Coir matting, woven', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '57022020', description: 'Coir carpets and other rugs', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '57022090', description: 'Other floor coverings of coir', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '61091000', description: 'T-SHIRTS, SINGLETS AND OTHER VESTS, OF COTTON', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '62052000', description: "MEN'S OR BOYS' SHIRTS OF COTTON", dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '63022100', description: 'OTHER PRINTED BED LINEN, OF COTTON', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '10061000', description: 'RICE IN THE HUSK (PADDY OR ROUGH)', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '10011900', description: 'DURUM WHEAT: OTHER', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '17011490', description: 'OTHER CANE SUGAR', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '07031010', description: 'ONIONS, FRESH OR CHILLED', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '72071210', description: 'BILLETS OF IRON OR NON-ALLOY STEEL', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '30049099', description: 'OTHER MEDICAMENTS', dutyType: 'EXPORT', isGstApplicable: true },
        { hsnCode: '87089900', description: 'OTHER PARTS AND ACCESSORIES OF MOTOR VEHICLES', dutyType: 'EXPORT', isGstApplicable: true }
    ];

    for (let item of hsnData) {
        await TariffHeader.upsert(item);
    }
    console.log('Seeded Tariff/HSN Master');
}

seedHsn().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
