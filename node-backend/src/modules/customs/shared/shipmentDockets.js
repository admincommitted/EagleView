import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';

const SQL_IN_CHUNK = 900;
const DOCKET_DIVISION_RX = /^[A-Z]{3}\/([A-Z]{2})\//;

const normalisedJobNo = (jobNo) =>
  String(jobNo || '')
    .trim()
    .toUpperCase();

async function docketsByJobNo(jobNos, divisionPattern) {
  const dockets = new Map();
  for (let start = 0; start < jobNos.length; start += SQL_IN_CHUNK) {
    const part = jobNos.slice(start, start + SQL_IN_CHUNK);
    const rows = await sequelize.query(
      `SELECT id, docketNo, division, upper(trim(ediJobNo)) k FROM Shipments
        WHERE upper(trim(ediJobNo)) IN (${part.map(() => '?').join(',')})
          AND coalesce(stage, '') <> 'Cancelled' AND upper(coalesce(division, '')) LIKE ? ORDER BY id`,
      { replacements: [...part, divisionPattern], type: QueryTypes.SELECT },
    );
    for (const row of rows) {
      if (!dockets.has(row.k)) dockets.set(row.k, []);
      dockets.get(row.k).push(row);
    }
  }
  return dockets;
}

function applyDocket(job, dockets) {
  // the same job no can be on an Air and a Sea docket: the one of the job's mode first
  const modeLetter = String(job.shipmentMode || '').toUpperCase()[0] || '';
  const docket = dockets.find((row) => String(row.division || '').toUpperCase()[0] === modeLetter) || dockets[0];
  if (docket) {
    job.docketNo = docket.docketNo;
    job.docketDivision = docket.division;
    job.docketId = docket.id;
    return;
  }
  if (!job.docketNo) return;
  const match = DOCKET_DIVISION_RX.exec(String(job.docketNo).toUpperCase());
  if (match) job.docketDivision = match[1];
}

/**
 * Puts the Shipment Registration docket on each listed job (docketNo, docketDivision, docketId).
 * `divisionSide` is 'I' for import divisions (AI / SI) and 'E' for export divisions (AE / SE).
 */
export async function attachShipmentDockets(jobs, divisionSide) {
  try {
    const jobNos = [...new Set(jobs.map((job) => normalisedJobNo(job.jobNo)).filter(Boolean))];
    const dockets = await docketsByJobNo(jobNos, `%${divisionSide}`);
    for (const job of jobs) applyDocket(job, dockets.get(normalisedJobNo(job.jobNo)) || []);
  } catch {
    // no Shipments table yet
  }
}
