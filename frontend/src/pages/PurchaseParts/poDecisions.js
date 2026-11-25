import { CheckCircle, Clock, XCircle } from 'lucide-react';

/** The PO approver's choices, keyed by the status they give the PO. */
export const PO_DECISIONS = {
  Approved: { verb: 'Approve', reasonVerb: '', buttonLabel: 'Approve PO', icon: CheckCircle, variant: 'success' },
  Rejected: { verb: 'Reject', reasonVerb: 'rejecting', buttonLabel: 'Reject PO', icon: XCircle, variant: 'destructive' },
  Hold: { verb: 'Hold', reasonVerb: 'holding', buttonLabel: 'Put on Hold', icon: Clock, variant: 'warning' },
};

export const canBeDecided = (po) => po.status === 'Pending Approval' || po.status === 'Hold';

/** A PO waiting for approval can be approved, rejected or held; one already on hold cannot be held again. */
export const decisionsFor = (po) => (canBeDecided(po)
  ? Object.keys(PO_DECISIONS).filter((status) => status !== 'Hold' || po.status !== 'Hold')
  : []);

export const decisionActions = (po, labelOf = (decision) => decision.buttonLabel) =>
  decisionsFor(po).map((status) => {
    const decision = PO_DECISIONS[status];
    return { key: status, label: labelOf(decision), icon: decision.icon, variant: decision.variant };
  });
