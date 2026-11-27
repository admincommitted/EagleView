import { runSql, selectRows } from './hubQuery.service.js';

// Small accounting masters, one table each. A field is [key, label, type, required]; a type "select:A,B" lists its options.
export const MASTER_DEFINITIONS = {
  sac: {
    title: 'SAC Master',
    table: 'AccSacCodes',
    fields: [
      ['code', 'SAC Code', 'text', true],
      ['description', 'Description', 'text', true],
      ['gstRate', 'GST %', 'number'],
      ['remarks', 'Remarks', 'text'],
    ],
  },
  gstcharges: {
    title: 'GST Charges',
    table: 'AccGstCharges',
    fields: [
      ['chargeName', 'Charge Name', 'text', true],
      ['sacCode', 'SAC Code', 'sac'],
      ['gstRate', 'GST %', 'number'],
      ['ledgerId', 'Income Ledger', 'ledger'],
      ['expenseLedgerId', 'Expense Ledger', 'ledger'],
      ['rcm', 'Reverse Charge (RCM)', 'bool'],
      ['exempt', 'Exempt / Nil', 'bool'],
    ],
  },
  chargerules: {
    title: 'Charge Rules',
    table: 'AccChargeRules',
    fields: [
      ['ruleName', 'Rule Name', 'text', true],
      ['chargeName', 'Charge', 'text', true],
      ['basis', 'Basis', 'select:PER SHIPMENT,PER KG,PER CBM,PER CONTAINER,PER DOCUMENT,PERCENT OF VALUE'],
      ['rate', 'Rate', 'number'],
      ['minAmount', 'Minimum', 'number'],
      ['currency', 'Currency', 'text'],
      ['mode', 'Mode', 'select:ALL,AIR EXPORT,AIR IMPORT,SEA EXPORT,SEA IMPORT,CUSTOMS'],
      ['ledgerId', 'Ledger', 'ledger'],
    ],
  },
  items: {
    title: 'Item Master',
    table: 'AccItems',
    fields: [
      ['itemCode', 'Item Code', 'text', true],
      ['itemName', 'Item Name', 'text', true],
      ['unit', 'Unit', 'text'],
      ['sacCode', 'SAC / HSN', 'sac'],
      ['gstRate', 'GST %', 'number'],
      ['rate', 'Rate', 'number'],
      ['ledgerId', 'Ledger', 'ledger'],
    ],
  },
  tdsparty: {
    title: 'TDS Party',
    table: 'AccTdsParties',
    fields: [
      ['ledgerId', 'Party Ledger', 'ledger', true],
      ['tdsNatureId', 'TDS Nature', 'tdsnature', true],
      ['rate', 'Rate %', 'number'],
      ['pan', 'PAN', 'text'],
      ['lowerCertNo', 'Lower Deduction Cert. No', 'text'],
      ['validFrom', 'Valid From', 'date'],
      ['validTo', 'Valid To', 'date'],
      ['thresholdLimit', 'Threshold', 'number'],
    ],
  },
  depreciation: {
    title: 'Depreciation Rates',
    table: 'AccDepreciationRates',
    fields: [
      ['assetCategory', 'Asset Category', 'text', true],
      ['slmRate', 'SLM % (Co. Act)', 'number'],
      ['wdvRate', 'WDV % (Co. Act)', 'number'],
      ['itActRate', 'IT Act %', 'number'],
      ['usefulLife', 'Useful Life (years)', 'number'],
      ['ledgerId', 'Asset Ledger', 'ledger'],
    ],
  },
  divisionmap: {
    title: 'Division Mapping',
    table: 'AccDivisionMaps',
    fields: [
      [
        'division',
        'Division',
        'select:AIR EXPORT,AIR IMPORT,SEA EXPORT,SEA IMPORT,CUSTOMS,TRANSPORT,WAREHOUSE,COURIER',
        true,
      ],
      ['branchCode', 'Branch', 'text'],
      ['costCentreId', 'Cost Centre', 'costcentre'],
      ['incomeLedgerId', 'Income Ledger', 'ledger'],
      ['expenseLedgerId', 'Expense Ledger', 'ledger'],
    ],
  },
  chequebooks: {
    title: 'Cheque Book Management',
    table: 'AccChequeBooks',
    fields: [
      ['bankLedgerId', 'Bank', 'ledger', true],
      ['bookNo', 'Book No', 'text'],
      ['fromNo', 'From Cheque No', 'text', true],
      ['toNo', 'To Cheque No', 'text', true],
      ['issuedOn', 'Received On', 'date'],
      ['nextNo', 'Next Cheque No', 'text'],
      ['status', 'Status', 'select:IN USE,FINISHED,CANCELLED'],
    ],
  },
  jobclosing: {
    title: 'Job Closing',
    table: 'AccJobClosings',
    fields: [
      ['jobNo', 'Job No', 'text', true],
      ['jobType', 'Job Type', 'select:AIR EXPORT,AIR IMPORT,SEA EXPORT,SEA IMPORT,CUSTOMS,OTHER'],
      ['closedOn', 'Closed On', 'date', true],
      ['closedBy', 'Closed By', 'text'],
      ['remarks', 'Remarks', 'text'],
    ],
  },
  approvals: {
    title: 'Approval System',
    table: 'AccApprovalRules',
    fields: [
      [
        'voucherType',
        'Voucher Type',
        'select:PAYMENT,RECEIPT,JOURNAL,PURCHASE,SALES,CONTRA,DEBIT NOTE,CREDIT NOTE',
        true,
      ],
      ['fromAmount', 'Amount From', 'number'],
      ['toAmount', 'Amount To', 'number'],
      ['approverName', 'Approver', 'text', true],
      ['level', 'Level', 'number'],
    ],
  },
};

const NUMERIC_FIELD_TYPES = ['number', 'ledger', 'tdsnature', 'costcentre'];

export const isNumericFieldType = (type) => NUMERIC_FIELD_TYPES.includes(type);

const columnTypeOf = (type) => {
  if (isNumericFieldType(type)) return 'REAL';
  return type === 'bool' ? 'TINYINT(1)' : 'TEXT';
};

const readyMasters = new Set();

/** Creates the master's table (and any column added to its definition since) the first time; answers its definition. */
export async function ensureMasterTable(kind) {
  const master = MASTER_DEFINITIONS[kind];
  if (readyMasters.has(kind)) return master;
  await runSql(`CREATE TABLE IF NOT EXISTS ${master.table} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${master.fields.map(([key, , type]) => key + ' ' + columnTypeOf(type)).join(', ')},
    isActive TINYINT(1) DEFAULT 1, createdAt DATETIME, updatedAt DATETIME)`);
  const existingColumns = new Set(
    (await selectRows(`PRAGMA table_info(${master.table})`)).map((column) => column.name),
  );
  for (const [key, , type] of master.fields) {
    if (!existingColumns.has(key)) await runSql(`ALTER TABLE ${master.table} ADD COLUMN ${key} ${columnTypeOf(type)}`);
  }
  readyMasters.add(kind);
  return master;
}
