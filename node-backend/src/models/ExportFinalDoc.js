import { sequelize, DataTypes } from '../config/database.js';

const ExportFinalDoc = sequelize.define('ExportFinalDoc', {
  sbNo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  jobNo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  docType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'FIRST_COPY, LEO_COPY, GATEPASS, OTHER',
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  messageId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Email Message-ID to prevent processing the same email twice',
  },
});

export default ExportFinalDoc;
