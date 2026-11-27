import { ApiResponse } from '../../../core/http/index.js';
import { fyWhere, where as awbBranchWhere } from '../../../utils/awb/awbBranch.js';
import { awbQuery, globalSearch } from './search.service.js';

export const globalSearchFailure = (error) => {
  console.error(error);
  return { error: 'Search failed' };
};

export const awbQueryFailure = (error) => {
  console.error(error);
  return { success: false, error: 'Query failed: ' + error.message };
};

export const searchEverything = async (req, res) => {
  ApiResponse.send(res, await globalSearch(req.query.q || ''));
};

export const searchAwbs = async (req, res) => {
  // the branch and financial year picked in the top bar
  const scope = { branchWhere: () => awbBranchWhere(req), yearWhere: () => fyWhere(req) };
  ApiResponse.send(res, await awbQuery(req.query, scope));
};
