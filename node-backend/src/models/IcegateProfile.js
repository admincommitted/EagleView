import { sequelize, DataTypes } from '../config/database.js';

const IcegateProfile = sequelize.define('IcegateProfile', {
  profileName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  loginId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  apiKey: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  baseUrl: {
    type: DataTypes.STRING,
    defaultValue: 'https://cisapi.icegate.gov.in',
  },
  linkedChaCode: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Optional CHA Code to auto-select this profile',
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  imapEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Email address to listen for ICEGATE PDFs',
  },
  imapAppPassword: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'App password for IMAP access',
  },
  imapHost: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'imap.gmail.com',
  },
  imapFolder: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'INBOX',
    comment: 'IMAP Folder/Label to scan',
  },
  imapPort: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 993,
  },
});

export default IcegateProfile;
