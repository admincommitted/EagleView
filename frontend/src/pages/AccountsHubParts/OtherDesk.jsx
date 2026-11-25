// Accounts > Other Transactions, built like iCAFFE's screens in EagleView's look.
//   Cheque Book Management - books per bank, every leaf (issued from payment vouchers, cancelled, unused), next cheque no
//   Job Closing            - income / expense / profit of every job; close (no new voucher for that job) or re-open
//   TDS Payable Updation   - TDS deducted per month and section against challans paid, due dates, late days
//   Approval System        - vouchers waiting (with the rule that applies), approve / return, decided list, rules
//   Inter Branch           - Bank Transfer / Journal / Cash Transfer: raise, accept or return, branch balances
export { ChequeBooksScreen } from './OtherDeskParts/sections/ChequeBooksScreen';
export { JobClosingScreen } from './OtherDeskParts/sections/JobClosingScreen';
export { TdsPayableScreen } from './OtherDeskParts/sections/TdsPayableScreen';
export { ApprovalsScreen } from './OtherDeskParts/sections/ApprovalsScreen';
export { InterBranchScreen } from './OtherDeskParts/sections/InterBranchScreen';
