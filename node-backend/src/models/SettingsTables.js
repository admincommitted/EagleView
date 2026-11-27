import { sequelize, DataTypes } from '../config/database.js';

// Settings screens kept in their own SQL tables (Settings > System Setup / Network-SFTP / ULIP / AI / WhatsApp / Email).
// Old key/value rows of AppSetting are copied in once (utils/settingsStore.js migrate()) and left in place;
// nothing reads them for these keys.
//
// Single-row tables (id = 1): CompanyProfile, SftpConfig, UlipConfig, AiConfig, WhatsappConfig, EmailConfig.
// List tables: AiModuleConfig (one row per module), WhatsappModuleNumber, EmailTemplate (one row per email type).
const S = (len = 255) => ({ type: DataTypes.STRING(len), allowNull: true });
const T = () => ({ type: DataTypes.TEXT, allowNull: true });
const B = (d = false) => ({ type: DataTypes.BOOLEAN, allowNull: false, defaultValue: d });

const CompanyProfile = sequelize.define(
  'CompanyProfile',
  {
    companyName: S(),
    legalName: S(),
    address1: S(),
    address2: S(),
    city: S(100),
    state: S(100),
    pincode: S(10),
    country: { type: DataTypes.STRING(60), defaultValue: 'INDIA' },
    gstin: S(15),
    pan: S(10),
    iec: S(10),
    cin: S(21),
    phone: S(30),
    email: S(150),
    website: S(150),
    defaultCurrency: { type: DataTypes.STRING(3), defaultValue: 'INR' },
    timezone: { type: DataTypes.STRING(50), defaultValue: 'Asia/Kolkata' },
    dateFormat: { type: DataTypes.STRING(12), defaultValue: 'DD/MM/YYYY' },
    // boxes of the Company Settings screen (/company-settings)
    tagline: S(200),
    lutNo: S(60),
    logoDataUrl: T(),
    bankName: S(150),
    accountName: S(150),
    accountNo: S(34),
    ifsc: S(11),
    swift: S(11),
    einvoiceUser: S(100),
    einvoicePass: S(200),
    einvoiceBaseUrl: S(300),
    einvoiceLastTestAt: { type: DataTypes.DATE, allowNull: true },
    einvoiceLastTestOk: { type: DataTypes.BOOLEAN, allowNull: true },
    einvoiceLastTestMessage: S(500),
    // printed on the GST invoice - fax, the registered office line and the notes (one per line)
    fax: S(30),
    registeredOffice: T(),
    invoiceNotes: T(),
  },
  { tableName: 'CompanyProfile' },
);

const SftpConfig = sequelize.define(
  'SftpConfig',
  {
    activeEnv: { type: DataTypes.STRING(12), defaultValue: 'test' },
    host: S(),
    testHost: S(),
    prodHost: S(),
    port: { type: DataTypes.INTEGER, defaultValue: 22 },
    username: S(),
    password: S(),
    privateKey: T(),
    passphrase: S(),
    publicKey: T(),
    vanSenderPima: S(50),
    vanRecipientId: S(50),
    vanCompanyName: S(),
    defaultCurrency: S(3),
    defaultChargeCode: S(4),
  },
  { tableName: 'SftpConfig' },
);

const UlipConfig = sequelize.define(
  'UlipConfig',
  {
    username: S(),
    password: S(),
    baseUrl: S(),
  },
  { tableName: 'UlipConfig' },
);

// ULIP APIs, added one by one on Settings > ULIP Integration. requestTemplate is the JSON body with
// {placeholders}, e.g. {"iecnumber":"{iec}"}; path is relative to UlipConfig.baseUrl (or a full https URL).
const UlipApi = sequelize.define(
  'UlipApi',
  {
    apiCode: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    apiName: { type: DataTypes.STRING(150), allowNull: false },
    category: S(40),
    method: { type: DataTypes.STRING(6), allowNull: false, defaultValue: 'POST' },
    path: { type: DataTypes.STRING(300), allowNull: false },
    requestTemplate: T(),
    description: T(),
    isActive: B(true),
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastTestAt: { type: DataTypes.DATE, allowNull: true },
    lastTestOk: { type: DataTypes.BOOLEAN, allowNull: true },
    lastTestMessage: S(500),
  },
  { tableName: 'UlipApi' },
);

const AiConfig = sequelize.define(
  'AiConfig',
  {
    provider: { type: DataTypes.STRING(20), defaultValue: 'GEMINI' },
    geminiApiKey: T(),
    chatbotUseAi: B(true),
  },
  { tableName: 'AiConfig' },
);

const AiModuleConfig = sequelize.define(
  'AiModuleConfig',
  {
    moduleType: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    model: S(80),
    prompt: T(),
  },
  { tableName: 'AiModuleConfig' },
);

const WhatsappConfig = sequelize.define(
  'WhatsappConfig',
  {
    enabled: B(false),
    mode: { type: DataTypes.STRING(10), defaultValue: 'qr' },
    provider: S(30),
    apiKey: T(),
    fromNumber: S(30),
    senderId: S(30),
    notifyMode: { type: DataTypes.STRING(12), defaultValue: 'instant' },
    notifyTime: { type: DataTypes.STRING(5), defaultValue: '09:00' },
    statusTemplate: T(),
    // approved WhatsApp template for API mode (business-initiated messages must be a template)
    templateName: S(100),
    templateLang: { type: DataTypes.STRING(10), defaultValue: 'en' },
    templateNamespace: S(100),
    apiVersion: { type: DataTypes.STRING(8), defaultValue: 'v21.0' },
  },
  { tableName: 'WhatsappConfig' },
);

const WhatsappModuleNumber = sequelize.define(
  'WhatsappModuleNumber',
  {
    moduleName: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    phoneNumber: { type: DataTypes.STRING(20), allowNull: false },
  },
  { tableName: 'WhatsappModuleNumber' },
);

const EmailConfig = sequelize.define(
  'EmailConfig',
  {
    smtpHost: S(),
    smtpPort: { type: DataTypes.INTEGER, defaultValue: 587 },
    smtpUser: S(),
    smtpPass: S(),
    smtpSecure: B(false),
    fromName: S(),
  },
  { tableName: 'EmailConfig' },
);

const EmailTemplate = sequelize.define(
  'EmailTemplate',
  {
    emailType: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    enabled: B(true),
    subject: S(300),
    body: T(),
    notifyMode: { type: DataTypes.STRING(12), defaultValue: 'instant' },
    notifyTime: { type: DataTypes.STRING(5), defaultValue: '09:00' },
  },
  { tableName: 'EmailTemplate' },
);

export {
  CompanyProfile,
  SftpConfig,
  UlipConfig,
  UlipApi,
  AiConfig,
  AiModuleConfig,
  WhatsappConfig,
  WhatsappModuleNumber,
  EmailConfig,
  EmailTemplate,
};
