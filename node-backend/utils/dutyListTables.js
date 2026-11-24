// Tables of the Customs Duty Lists master (22-Nov-2026). One place for the CREATE statements: used by routes/dutyLists.js
// (made on first use of the screen) and by load_logisys_duty_lists.js (made before loading, if the backend was not restarted yet).
module.exports = {
  cvd: { table: 'CvdDutyRates', idx: ['cth', 'notifNo'],
    ddl: `CREATE TABLE IF NOT EXISTS CvdDutyRates (id INTEGER PRIMARY KEY AUTOINCREMENT, notifNo VARCHAR(20) NOT NULL, serialNo VARCHAR(10), itemSlNo VARCHAR(10), suppSlNo VARCHAR(10), cth VARCHAR(8) NOT NULL,
      originCountry VARCHAR(2), exportCountry VARCHAR(2), rate DECIMAL(10,4), calcMethod VARCHAR(40), description TEXT, exporter TEXT, producer TEXT, source VARCHAR(20), srcKey VARCHAR(64),
      isActive TINYINT(1) NOT NULL DEFAULT 1, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)` },
  cess: { table: 'ExportCessRates', idx: ['ritc'],
    ddl: `CREATE TABLE IF NOT EXISTS ExportCessRates (id INTEGER PRIMARY KEY AUTOINCREMENT, ritc VARCHAR(8), serialNo VARCHAR(10), tariffValue DECIMAL(14,2), tariffUnit VARCHAR(10), ratePercent DECIMAL(10,4),
      rateRs DECIMAL(14,2), unit VARCHAR(10), description TEXT, source VARCHAR(20), srcKey VARCHAR(64), isActive TINYINT(1) NOT NULL DEFAULT 1, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)` },
  tariffvalue: { table: 'TariffValueRates', idx: ['cth'],
    ddl: `CREATE TABLE IF NOT EXISTS TariffValueRates (id INTEGER PRIMARY KEY AUTOINCREMENT, notifNo VARCHAR(20) NOT NULL, serialNo VARCHAR(10), cth VARCHAR(8) NOT NULL, description TEXT, tariffValue DECIMAL(14,2),
      currency VARCHAR(3), uqc VARCHAR(6), effectiveDate DATE, source VARCHAR(20), srcKey VARCHAR(64), isActive TINYINT(1) NOT NULL DEFAULT 1, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)` },
};
