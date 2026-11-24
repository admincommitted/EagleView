const { sequelize } = require('./db');
const TariffHeader = require('./models/TariffHeader');
const hsn = require('hsn-code-package');

async function seedAllHsn() {
    await sequelize.sync();
    
    console.log('Fetching HSN codes from package...');
    const allCodes = hsn.getAllHsn();
    console.log(`Found ${allCodes.length} codes.`);

    // Map them to TariffHeader format
    const tariffData = allCodes.map(item => ({
        hsnCode: item.code,
        description: item.description.substring(0, 255), // truncate if too long for DB
        dutyType: 'EXPORT', // Or both, but let's default to EXPORT for now
        isGstApplicable: true
    }));

    console.log('Bulk inserting into TariffHeader...');
    
    // Chunk size 1000 to prevent SQL "too many variables" errors
    const chunkSize = 1000;
    for (let i = 0; i < tariffData.length; i += chunkSize) {
        const chunk = tariffData.slice(i, i + chunkSize);
        // Use ignoreDuplicates in Postgres/MySQL, or for SQLite we can use ignoreDuplicates: true or updateOnDuplicate
        try {
            await TariffHeader.bulkCreate(chunk, { ignoreDuplicates: true });
        } catch (err) {
            console.error(`Error inserting chunk ${i}:`, err.message);
        }
        process.stdout.write(`\rInserted ${Math.min(i + chunkSize, tariffData.length)} / ${tariffData.length}`);
    }
    console.log('\nSeeding complete.');
}

seedAllHsn().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
