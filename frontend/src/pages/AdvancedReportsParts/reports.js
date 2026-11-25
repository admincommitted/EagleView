import { profitabilityReport, tonnageReport } from './operationsReports';
import { collectionReport, expensesReport, salesReport } from './financialReports';

export const REPORTS = [profitabilityReport, tonnageReport, salesReport, expensesReport, collectionReport];

export const REPORT_GROUPS = ['Operations', 'Financials'];

export const reportById = (id) => REPORTS.find((report) => report.id === id) || profitabilityReport;
