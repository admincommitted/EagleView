const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// 30-Oct-2026: the Voucher Entry screen has an "Attach Supporting Docs" button that did nothing.
// A voucher without its bill / challan / bank advice is the first thing an auditor asks for, so the
// attachments are stored properly: the file on disk under uploads/vouchers, the row here.
const VoucherDocument = sequelize.define('VoucherDocument', {
    voucherId:    { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Vouchers', key: 'id' }, onDelete: 'CASCADE' },
    // a draft voucher has no id yet, so the screen can park files under a client-side key and claim them on save
    draftKey:     { type: DataTypes.STRING(60), allowNull: true },
    fileName:     { type: DataTypes.STRING, allowNull: false },
    originalName: { type: DataTypes.STRING, allowNull: false },
    mimeType:     { type: DataTypes.STRING, allowNull: false },
    filePath:     { type: DataTypes.STRING, allowNull: false },
    size:         { type: DataTypes.INTEGER, allowNull: false },
    documentType: { type: DataTypes.STRING(40), defaultValue: 'SUPPORTING' },
    uploadedBy:   { type: DataTypes.INTEGER, allowNull: true },
    uploadedByName: { type: DataTypes.STRING(150), allowNull: true },
}, { timestamps: true });

module.exports = VoucherDocument;
