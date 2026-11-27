import { z } from 'zod';
import { DIVS, DOCS } from '../../../utils/common/numberSeries.js';

const MAX_FORMAT_LENGTH = 40;
const MAX_PAD_DIGITS = 10;
const MAX_NEXT_NUMBER = 99999999;
const FORMAT_TAGS = /\{(N|YY|FY|DIV)\}/g;
const KNOWN_TAG = /^\{(N|YY|FY|DIV)\}$/;
const FORBIDDEN_FORMAT_CHARACTERS = /[\\?#%"'<>|*\s]/;

function isValidFormat(format) {
  if (!/\{N\}/.test(format) || format.length > MAX_FORMAT_LENGTH) return false;
  if (FORBIDDEN_FORMAT_CHARACTERS.test(format.replace(FORMAT_TAGS, ''))) return false;
  const tags = format.match(/\{[^}]*\}/g) || [];
  return tags.every((tag) => KNOWN_TAG.test(tag));
}

/** The first rule a number series row breaks, in the order the settings screen has always shown them. */
function firstSeriesProblem(series) {
  if (!DOCS[series.docType]) return 'Choose the document';
  if (!series.branchCode) return 'Branch is required';
  if (series.division && !DIVS.includes(series.division))
    return 'Division must be AE, AI, SE, SI or blank (all divisions)';
  if (!/^\d{4}$/.test(series.fyCode)) return 'Financial year like 2627';
  if (!isValidFormat(series.format)) {
    return 'Format must have {N}; tags {N} {YY} {FY} {DIV}; letters, digits, / - _ . only (max 40)';
  }
  if (series.pad < 0 || series.pad > MAX_PAD_DIGITS) return 'Digits 0 - 10';
  if (!Number.isInteger(series.nextNo) || series.nextNo < 1 || series.nextNo > MAX_NEXT_NUMBER) {
    return 'Next number must be 1 or more';
  }
  return null;
}

/** A cleaned number series row (see cleanSeries in the service). */
export const numberSeriesSchema = z.looseObject({}).superRefine((series, context) => {
  const problem = firstSeriesProblem(series);
  if (problem) context.addIssue({ code: 'custom', message: problem });
});
