// 07-Nov-2026: Profit & Loss on the shared statement engine (AccountsHubParts/FinStatement.jsx); the old version is in backups\fin_statements_*
import React from 'react';
import { useGlobalContext } from '../GlobalContext';
import FinStatement from './AccountsHubParts/FinStatement';
export default function ProfitAndLoss() {
  const g = useGlobalContext() || {};
  const k = ((g.activeBranch && (g.activeBranch.isAll ? 'ALL' : g.activeBranch.branchCode)) || '') + '|' + ((g.activeYear && g.activeYear.id) || '');
  return <FinStatement key={k} mode="pl" />;
}
