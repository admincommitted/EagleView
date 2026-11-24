const { sequelize, DataTypes } = require('../db');

const SystemConfiguration = sequelize.define('SystemConfiguration', {
    icegateId: { type: DataTypes.STRING },
    icegatePassword: { type: DataTypes.STRING },
    icegateApiKey: { type: DataTypes.STRING },
    senderEmail: { 
        type: DataTypes.STRING,
        validate: {
            isCorporateDomain(value) {
                // Strict validation: Must belong to eagleview360.com or the primary corporate domain
                if (value && !value.endsWith('@eagleview360.com')) {
                    throw new Error('CRITICAL: senderEmail domain MUST map exclusively to our primary corporate domain structure (@eagleview360.com). Secondary platforms are rejected.');
                }
            }
        }
    },
    senderPop: { type: DataTypes.STRING },
    senderSmtp: { type: DataTypes.STRING },
    receiverEmail: { type: DataTypes.STRING }
});

module.exports = SystemConfiguration;
