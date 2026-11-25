import axiosInstance from './axiosInstance';

const getData = async (url) => (await axiosInstance.get(url)).data;

export const globalContextApi = {
  companyBranches: () => getData('/masters/company-branches'),
  myBranchScope: () => getData('/branch-scope/me'),
  financialYears: () => getData('/masters/financial-years'),
};
