import { ApiResponse } from '../../core/http/index.js';
import { where as awbBranchWhere } from '../../utils/awb/awbBranch.js';
import * as reportsService from './reports.service.js';
import * as businessReportsService from './businessReports.service.js';

/** Answer of an unexpected failure: { success: false, error }, after the old route's log line when it had one. */
export const failureBody = (logLabel) => (error) => {
  if (logLabel) console.error(logLabel, error);
  return { success: false, error: error.message };
};

export const forwarderTransactions = async (req, res) => {
  ApiResponse.send(res, await reportsService.forwarderTransactions(req.query));
};

export const exportData = async (req, res) => {
  ApiResponse.send(res, await reportsService.exportData(req.query));
};

// the AWB reports show only the branch picked in the top bar
export const tonnageReport = async (req, res) => {
  ApiResponse.send(res, await reportsService.tonnageReport(await awbBranchWhere(req), req.query));
};

export const csrReport = async (req, res) => {
  ApiResponse.send(res, await reportsService.csrReport(await awbBranchWhere(req), req.query));
};

export const listAwbAgents = async (req, res) => {
  ApiResponse.send(res, await reportsService.listAwbAgents());
};

export const listCsrPeriods = (req, res) => {
  ApiResponse.send(res, reportsService.listCsrPeriods());
};

export const directorMis = async (req, res) => {
  ApiResponse.send(res, await businessReportsService.directorMis(req.query));
};

export const unbilledJobs = async (req, res) => {
  ApiResponse.send(res, await businessReportsService.unbilledJobs(req.query));
};

export const expenseRegister = async (req, res) => {
  ApiResponse.send(res, await businessReportsService.expenseRegister(req.query));
};

export const collectionReport = async (req, res) => {
  ApiResponse.send(res, await businessReportsService.collectionReport(req.query));
};
