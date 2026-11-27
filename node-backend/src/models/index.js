import { sequelize } from '../config/database.js';

// Loaded first in this fixed order (keep it), then the rest alphabetically.
import Country from './Country.js';
import State from './State.js';
import City from './City.js';
import AppSetting from './AppSetting.js';
import {
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
} from './SettingsTables.js';
import Notification, { NotificationRead } from './Notification.js';
import User from './User.js';
import UserProfile from './UserProfile.js';
import UserSettings from './UserSettings.js';
import EmployeeMaster from './EmployeeMaster.js';
import AttendanceLog from './AttendanceLog.js';
import LeaveRequest from './LeaveRequest.js';
import HRAuditLog from './HRAuditLog.js';
import FieldAgent from './FieldAgent.js';
import FieldAgentLocation from './FieldAgentLocation.js';
import MasterAWB from './MasterAWB.js';
import AwbLog from './AwbLog.js';
import ExportFinalDoc from './ExportFinalDoc.js';
import HouseAWB from './HouseAWB.js';
import SpecialHandlingCode from './SpecialHandlingCode.js';
import AwbStock from './AwbStock.js';
import HawbStock from './HawbStock.js';
import Party from './Party.js';
import AwbRateLine from './AwbRateLine.js';
import AwbOtherCharge from './AwbOtherCharge.js';
import Tariff from './Tariff.js';
import IataAgent from './IataAgent.js';
import MasterData from './Master.js';
import Airport from './Airport.js';
import Airline from './Airline.js';
import Currency from './Currency.js';
import Charge from './Charge.js';
import PartyDocument from './PartyDocument.js';
import PartyBranch from './PartyBranch.js';
import PartyADCode from './PartyADCode.js';
import PartyDrawbackAccount from './PartyDrawbackAccount.js';
import ChaMaster from './ChaMaster.js';
import JobSequence from './JobSequence.js';
import CompanyBranch from './CompanyBranch.js';
import FinancialYear from './FinancialYear.js';
import FinancialPeriod from './FinancialPeriod.js';
import UserPermission from './UserPermission.js';
import AeoMaster from './AeoMaster.js';
import Airwaybill from './Airwaybill.js';
import ExportJob from './ExportJob.js';
import ExportInvoice from './ExportInvoice.js';
import ExportItem from './ExportItem.js';
import ExportContainer from './ExportContainer.js';
import ExportDocument from './ExportDocument.js';
import ExportDrawback from './ExportDrawback.js';
import ExportLicense from './ExportLicense.js';
import ImportJob from './ImportJob.js';
import ImportInvoice from './ImportInvoice.js';
import ImportItem from './ImportItem.js';
import ImportContainer from './ImportContainer.js';
import AwbOci from './AwbOci.js';
import AwbDimension from './AwbDimension.js';
import IcegateProfile from './IcegateProfile.js';
import AccountGroup from './AccountGroup.js';
import AccountLedger from './AccountLedger.js';
import TdsNature from './TdsNature.js';
import Voucher from './Voucher.js';
import VoucherDetail from './VoucherDetail.js';
import Invoice from './Invoice.js';
import InvoiceItem from './InvoiceItem.js';
import VoucherType from './VoucherType.js';
import CostCategory from './CostCategory.js';
import CostCentre from './CostCentre.js';
import VoucherDocument from './VoucherDocument.js';
import Budget from './Budget.js';
import LorryReceipt from './LorryReceipt.js';
import FreightEvent from './FreightEvent.js';
import Lead from './Lead.js';
import Quotation from './Quotation.js';
import QuotationCharge from './QuotationCharge.js';
import VoucherAllocation from './VoucherAllocation.js';
import CreditFollowUp from './CreditFollowUp.js';
import CreditPolicy from './CreditPolicy.js';
import InventoryGroup from './InventoryGroup.js';
import InventoryCategory from './InventoryCategory.js';
import UnitOfMeasure from './UnitOfMeasure.js';
import Godown from './Godown.js';
import StockItem from './StockItem.js';
import WhatsappNotificationQueue from './WhatsappNotificationQueue.js';

import Asset from './Asset.js';
import AWBDocument from './AWBDocument.js';
import AwbExtraDoc from './AwbExtraDoc.js';
import AwbTemplate from './AwbTemplate.js';
import AwbTracking from './AwbTracking.js';
import AwbTrackingEvent from './AwbTrackingEvent.js';
import Bond from './Bond.js';
import ChatMessage from './ChatMessage.js';
import { CustomerContract, ContractFreightRate, ContractCharge, ContractTransportRate } from './Contract.js';
import CurrencyRateHistory from './CurrencyRateHistory.js';
import DocumentSeries from './DocumentSeries.js';
import Drawback from './Drawback.js';
import DsrTemplate from './DsrTemplate.js';
import DutyNotifDetail from './DutyNotifDetail.js';
import DutyNotifHeader from './DutyNotifHeader.js';
import ESanchit from './ESanchit.js';
import ExportPolicy from './ExportPolicy.js';
import IataDgrMaster from './IataDgrMaster.js';
import IataExchangeRate from './IataExchangeRate.js';
import IataShcConflict from './IataShcConflict.js';
import ImportFinalDoc from './ImportFinalDoc.js';
import ItemTemplate from './ItemTemplate.js';
import JobTimeline from './JobTimeline.js';
import License from './License.js';
import PartyItemMaster from './PartyItemMaster.js';
import PenaltyRule from './PenaltyRule.js';
import POItem from './POItem.js';
import Port from './Port.js';
import PurchaseOrder from './PurchaseOrder.js';
import Rodtep from './Rodtep.js';
import Rosctl from './Rosctl.js';
import RspAbatement from './RspAbatement.js';
import SchemeCode from './SchemeCode.js';
import ShippingLine from './ShippingLine.js';
import SphMaster from './SphMaster.js';
import StatusMaster from './StatusMaster.js';
import TactCarrierRule from './TactCarrierRule.js';
import TactCountryRule from './TactCountryRule.js';
import TactEquipmentRule from './TactEquipmentRule.js';
import TactProportionalRate from './TactProportionalRate.js';
import TactRateDetail from './TactRateDetail.js';
import TactRateSector from './TactRateSector.js';
import TactSurcharge from './TactSurcharge.js';
import TariffComponent from './TariffComponent.js';
import TariffDutyComponent from './TariffDutyComponent.js';
import TariffHeader from './TariffHeader.js';
import Transporter from './Transporter.js';
import Uqc from './Uqc.js';
import UserPreference from './UserPreference.js';
import Vendor from './Vendor.js';
import Vessel from './Vessel.js';
import Warehouse from './Warehouse.js';

// AWB child rows (SPH, OCI, dimensions, rate lines, other charges) share one table for both AWB kinds:
// MAWB / direct AWB rows and HAWB rows have separate id ranges, so awbType tells them apart.
const masterAwbRowsScope = () => ({ awbType: ['AWB', 'MAWB'] });
const houseAwbRowsScope = () => ({ awbType: 'HAWB' });
const AWB_CHILD_MODELS = [SpecialHandlingCode, AwbOci, AwbDimension, AwbRateLine, AwbOtherCharge];

function defineUserAssociations() {
  User.hasOne(UserProfile, { foreignKey: 'userId', as: 'profile' });
  UserProfile.belongsTo(User, { foreignKey: 'userId' });
  User.hasOne(UserSettings, { foreignKey: 'userId', as: 'settings' });
  UserSettings.belongsTo(User, { foreignKey: 'userId' });
  User.hasMany(UserPermission, { foreignKey: 'userId', as: 'permissions' });
  UserPermission.belongsTo(User, { foreignKey: 'userId' });
}

function definePartyAssociations() {
  Party.hasMany(PartyDocument, { foreignKey: 'partyId', as: 'kycDocs' });
  PartyDocument.belongsTo(Party, { foreignKey: 'partyId' });
  Party.hasMany(PartyBranch, { foreignKey: 'partyId', as: 'branches' });
  PartyBranch.belongsTo(Party, { foreignKey: 'partyId' });
  Party.hasMany(PartyADCode, { foreignKey: 'partyId', as: 'adCodes' });
  PartyADCode.belongsTo(Party, { foreignKey: 'partyId' });
  Party.hasMany(PartyDrawbackAccount, { foreignKey: 'partyId', as: 'drawbackAccounts' });
  PartyDrawbackAccount.belongsTo(Party, { foreignKey: 'partyId' });
}

function defineLocationAssociations() {
  Country.hasMany(State, { foreignKey: 'countryId', as: 'states' });
  State.belongsTo(Country, { foreignKey: 'countryId' });
  State.hasMany(City, { foreignKey: 'stateId', as: 'cities' });
  City.belongsTo(State, { foreignKey: 'stateId' });
  City.belongsTo(Country, { foreignKey: 'countryId' });
}

function defineMasterAssociations() {
  FinancialYear.hasMany(FinancialPeriod, {
    foreignKey: 'financialYearId',
    as: 'periods',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
  FinancialPeriod.belongsTo(FinancialYear, { foreignKey: 'financialYearId' });

  TariffHeader.hasMany(TariffComponent, { as: 'components', foreignKey: 'tariffHeaderId', onDelete: 'CASCADE' });
  TariffComponent.belongsTo(TariffHeader, { foreignKey: 'tariffHeaderId' });

  DutyNotifHeader.hasMany(DutyNotifDetail, { as: 'details', foreignKey: 'headerId', onDelete: 'CASCADE' });
  DutyNotifDetail.belongsTo(DutyNotifHeader, { foreignKey: 'headerId' });

  TactRateSector.hasMany(TactRateDetail, { foreignKey: 'sectorId', as: 'rateDetails' });
  TactRateDetail.belongsTo(TactRateSector, { foreignKey: 'sectorId' });
}

function defineAwbAssociations() {
  HawbStock.belongsTo(Party, { foreignKey: 'partyId', as: 'party' });

  for (const childModel of AWB_CHILD_MODELS) {
    Airwaybill.hasMany(childModel, { foreignKey: 'awbId', scope: masterAwbRowsScope(), constraints: false });
  }
  for (const childModel of AWB_CHILD_MODELS) {
    HouseAWB.hasMany(childModel, { foreignKey: 'awbId', scope: houseAwbRowsScope(), constraints: false });
  }
}

function defineExportJobAssociations() {
  ExportJob.hasMany(ExportInvoice, { foreignKey: 'exportJobId', as: 'invoices', onDelete: 'CASCADE' });
  ExportInvoice.belongsTo(ExportJob, { foreignKey: 'exportJobId' });

  ExportInvoice.hasMany(ExportItem, { foreignKey: 'exportInvoiceId', as: 'items', onDelete: 'CASCADE' });
  ExportItem.belongsTo(ExportInvoice, { foreignKey: 'exportInvoiceId' });

  ExportJob.hasMany(ExportContainer, { foreignKey: 'exportJobId', as: 'containers', onDelete: 'CASCADE' });
  ExportContainer.belongsTo(ExportJob, { foreignKey: 'exportJobId' });

  ExportJob.hasMany(ExportDocument, { foreignKey: 'exportJobId', as: 'docs', onDelete: 'CASCADE' });
  ExportDocument.belongsTo(ExportJob, { foreignKey: 'exportJobId' });

  ExportJob.hasMany(ExportDrawback, { foreignKey: 'exportJobId', as: 'dbkItems', onDelete: 'CASCADE' });
  ExportDrawback.belongsTo(ExportJob, { foreignKey: 'exportJobId' });

  ExportJob.hasMany(ExportLicense, { foreignKey: 'exportJobId', as: 'licenseItems', onDelete: 'CASCADE' });
  ExportLicense.belongsTo(ExportJob, { foreignKey: 'exportJobId' });
}

function defineImportJobAssociations() {
  ImportJob.hasMany(ImportInvoice, { foreignKey: 'importJobId', as: 'invoices', onDelete: 'CASCADE' });
  ImportInvoice.belongsTo(ImportJob, { foreignKey: 'importJobId' });

  ImportInvoice.hasMany(ImportItem, { foreignKey: 'importInvoiceId', as: 'items', onDelete: 'CASCADE' });
  ImportItem.belongsTo(ImportInvoice, { foreignKey: 'importInvoiceId' });

  ImportJob.hasMany(ImportContainer, { foreignKey: 'importJobId', as: 'containers', onDelete: 'CASCADE' });
  ImportContainer.belongsTo(ImportJob, { foreignKey: 'importJobId' });

  ImportJob.belongsTo(ImportJob, { foreignKey: 'inBondJobId', as: 'warehouseJob' });
}

function defineSalesAssociations() {
  Lead.hasMany(Quotation, { as: 'quotations', foreignKey: 'leadId' });
  Quotation.belongsTo(Lead, { as: 'lead', foreignKey: 'leadId' });
  Quotation.hasMany(QuotationCharge, { as: 'charges', foreignKey: 'quotationId' });
  QuotationCharge.belongsTo(Quotation, { as: 'quotation', foreignKey: 'quotationId' });

  CustomerContract.hasMany(ContractFreightRate, { foreignKey: 'contractId', as: 'freightRates', onDelete: 'CASCADE' });
  CustomerContract.hasMany(ContractCharge, { foreignKey: 'contractId', as: 'charges', onDelete: 'CASCADE' });
  CustomerContract.hasMany(ContractTransportRate, {
    foreignKey: 'contractId',
    as: 'transportRates',
    onDelete: 'CASCADE',
  });
}

function definePurchaseAssociations() {
  PurchaseOrder.belongsTo(Vendor, { foreignKey: 'VendorID' });
  Vendor.hasMany(PurchaseOrder, { foreignKey: 'VendorID' });
  PurchaseOrder.hasMany(POItem, { foreignKey: 'PO_ID', as: 'items' });
  POItem.belongsTo(PurchaseOrder, { foreignKey: 'PO_ID' });
}

function defineAccountAssociations() {
  Voucher.hasMany(VoucherAllocation, { as: 'allocations', foreignKey: 'voucherId' });
  VoucherAllocation.belongsTo(Voucher, { as: 'voucher', foreignKey: 'voucherId' });
  VoucherAllocation.belongsTo(Voucher, { as: 'againstVoucher', foreignKey: 'againstVoucherId' });
  VoucherAllocation.belongsTo(AccountLedger, { as: 'ledger', foreignKey: 'ledgerId' });

  AccountLedger.hasMany(CreditFollowUp, { as: 'creditFollowUps', foreignKey: 'ledgerId' });
  CreditFollowUp.belongsTo(AccountLedger, { as: 'ledger', foreignKey: 'ledgerId' });
  AccountLedger.hasOne(CreditPolicy, { as: 'creditPolicy', foreignKey: 'ledgerId' });
  CreditPolicy.belongsTo(AccountLedger, { as: 'ledger', foreignKey: 'ledgerId' });

  Voucher.hasMany(VoucherDocument, { as: 'documents', foreignKey: 'voucherId' });
  VoucherDocument.belongsTo(Voucher, { foreignKey: 'voucherId' });

  CostCentre.hasMany(VoucherDetail, { as: 'voucherLines', foreignKey: 'costCentreId' });
  VoucherDetail.belongsTo(CostCentre, { as: 'costCentre', foreignKey: 'costCentreId' });
  CostCategory.hasMany(CostCentre, { as: 'costCentres', foreignKey: 'categoryId' });
  CostCentre.belongsTo(CostCategory, { as: 'category', foreignKey: 'categoryId' });
  CostCentre.hasMany(CostCentre, { as: 'subCentres', foreignKey: 'parentId' });
  CostCentre.belongsTo(CostCentre, { as: 'parentCentre', foreignKey: 'parentId' });
}

function defineInventoryAssociations() {
  InventoryGroup.hasMany(InventoryGroup, { as: 'subGroups', foreignKey: 'parentId' });
  InventoryGroup.belongsTo(InventoryGroup, { as: 'parentGroup', foreignKey: 'parentId' });

  InventoryCategory.hasMany(InventoryCategory, { as: 'subCategories', foreignKey: 'parentId' });
  InventoryCategory.belongsTo(InventoryCategory, { as: 'parentCategory', foreignKey: 'parentId' });

  Godown.hasMany(Godown, { as: 'subGodowns', foreignKey: 'parentId' });
  Godown.belongsTo(Godown, { as: 'parentGodown', foreignKey: 'parentId' });

  StockItem.belongsTo(InventoryGroup, { as: 'group', foreignKey: 'groupId' });
  StockItem.belongsTo(InventoryCategory, { as: 'category', foreignKey: 'categoryId' });
  StockItem.belongsTo(UnitOfMeasure, { as: 'uom', foreignKey: 'uomId' });
}

function defineLedgerAssociations() {
  AccountGroup.hasMany(AccountGroup, { as: 'subGroups', foreignKey: 'parentId' });
  AccountGroup.belongsTo(AccountGroup, { as: 'parentGroup', foreignKey: 'parentId' });
  AccountGroup.hasMany(AccountLedger, { as: 'ledgers', foreignKey: 'groupId' });
  AccountLedger.belongsTo(AccountGroup, { as: 'group', foreignKey: 'groupId' });

  Voucher.belongsTo(VoucherType, { foreignKey: 'voucherTypeId', as: 'voucherType' });
  Voucher.hasMany(VoucherDetail, { foreignKey: 'voucherId', as: 'details' });
  VoucherDetail.belongsTo(Voucher, { foreignKey: 'voucherId' });
  VoucherDetail.belongsTo(AccountLedger, { foreignKey: 'ledgerId', as: 'ledger' });

  Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items' });
  InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });
  Invoice.belongsTo(AccountLedger, { foreignKey: 'partyId', as: 'party' });
  InvoiceItem.belongsTo(AccountLedger, { foreignKey: 'chargeLedgerId', as: 'chargeLedger' });
}

// Inside each group the calls keep their old order: the first association that declares a foreign key
// fixes its constraint options (onDelete / onUpdate).
function defineAssociations() {
  defineUserAssociations();
  definePartyAssociations();
  defineLocationAssociations();
  defineMasterAssociations();
  defineAwbAssociations();
  defineSalesAssociations();
  definePurchaseAssociations();
  defineAccountAssociations();
  defineInventoryAssociations();
  defineLedgerAssociations();
  defineExportJobAssociations();
  defineImportJobAssociations();
}

defineAssociations();

const Master = MasterData;

export {
  Country,
  State,
  City,
  AppSetting,
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
  Notification,
  NotificationRead,
  User,
  UserProfile,
  UserSettings,
  EmployeeMaster,
  AttendanceLog,
  LeaveRequest,
  HRAuditLog,
  FieldAgent,
  FieldAgentLocation,
  MasterAWB,
  AwbLog,
  ExportFinalDoc,
  HouseAWB,
  SpecialHandlingCode,
  AwbStock,
  HawbStock,
  Party,
  AwbRateLine,
  AwbOtherCharge,
  Tariff,
  IataAgent,
  Master,
  MasterData,
  Airport,
  Airline,
  Currency,
  Charge,
  PartyDocument,
  PartyBranch,
  PartyADCode,
  PartyDrawbackAccount,
  ChaMaster,
  JobSequence,
  CompanyBranch,
  FinancialYear,
  FinancialPeriod,
  UserPermission,
  AeoMaster,
  Airwaybill,
  ExportJob,
  ExportInvoice,
  ExportItem,
  ExportContainer,
  ExportDocument,
  ExportDrawback,
  ExportLicense,
  ImportJob,
  ImportInvoice,
  ImportItem,
  ImportContainer,
  AwbOci,
  AwbDimension,
  IcegateProfile,
  AccountGroup,
  AccountLedger,
  TdsNature,
  Voucher,
  VoucherDetail,
  Invoice,
  InvoiceItem,
  VoucherType,
  CostCategory,
  CostCentre,
  VoucherDocument,
  Budget,
  LorryReceipt,
  FreightEvent,
  Lead,
  Quotation,
  QuotationCharge,
  VoucherAllocation,
  CreditFollowUp,
  CreditPolicy,
  InventoryGroup,
  InventoryCategory,
  UnitOfMeasure,
  Godown,
  StockItem,
  WhatsappNotificationQueue,
  Asset,
  AWBDocument,
  AwbExtraDoc,
  AwbTemplate,
  AwbTracking,
  AwbTrackingEvent,
  Bond,
  ChatMessage,
  CustomerContract,
  ContractFreightRate,
  ContractCharge,
  ContractTransportRate,
  CurrencyRateHistory,
  DocumentSeries,
  Drawback,
  DsrTemplate,
  DutyNotifDetail,
  DutyNotifHeader,
  ESanchit,
  ExportPolicy,
  IataDgrMaster,
  IataExchangeRate,
  IataShcConflict,
  ImportFinalDoc,
  ItemTemplate,
  JobTimeline,
  License,
  PartyItemMaster,
  PenaltyRule,
  POItem,
  Port,
  PurchaseOrder,
  Rodtep,
  Rosctl,
  RspAbatement,
  SchemeCode,
  ShippingLine,
  SphMaster,
  StatusMaster,
  TactCarrierRule,
  TactCountryRule,
  TactEquipmentRule,
  TactProportionalRate,
  TactRateDetail,
  TactRateSector,
  TactSurcharge,
  TariffComponent,
  TariffDutyComponent,
  TariffHeader,
  Transporter,
  Uqc,
  UserPreference,
  Vendor,
  Vessel,
  Warehouse,
  sequelize,
};
