import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui';

const MAX_DRAWBACK_ROWS = 5;
const POLICY_LABEL = 'Export policy (DGFT)';

// compliance requirements of a RITC from the masters of this system (Tariff, Export Policy, RoDTEP, Drawback)
export default function CcrModal({ ctx }) {
  const { ccrItem, setCcrItem, tariffs, exportPoliciesMaster, drawbacksMaster, rodtepsMaster } = ctx;
  if (!ccrItem) return null;
  const { ritc } = ccrItem;
  const tariff = tariffs.find((row) => String(row.hsnCode) === ritc);
  const policy = exportPoliciesMaster.find((row) => String(row.tariffItem) === ritc);
  const drawbacks = drawbacksMaster.filter((row) => String(row.tariffItem || '').replace(/\D/g, '').startsWith(ritc.slice(0, 4))).slice(0, MAX_DRAWBACK_ROWS);
  const rodtep = rodtepsMaster.find((row) => String(row.tariffItem) === ritc);
  const restricted = policy && !/FREE/i.test(policy.dgftPolicy || '');
  const facts = [
    ['Description', tariff?.description || ccrItem.desc || '-'],
    ['Standard UQC', tariff?.uqc || policy?.uqc || '-'],
    [POLICY_LABEL, policy ? `${policy.dgftPolicy || 'FREE'}${policy.description ? ` - ${policy.description}` : ''}` : 'Not in the Export Policy master - check the ITC(HS) export schedule'],
    ['Export duty', policy && parseFloat(policy.exportDuty) ? `${policy.exportDuty} %` : 'Nil'],
    ['RoDTEP', rodtep ? `${rodtep.rate || 0}%${rodtep.cap ? ` (cap ${rodtep.cap} per unit)` : ''}` : 'Not in the RoDTEP master'],
    ['Drawback entries', drawbacks.length ? drawbacks.map((row) => `${row.tariffItem} ${row.drawbackRate || 0}%`).join(', ') : `None in the master for ${ritc.slice(0, 4)}`],
  ];

  return (
    <Modal
      open title={`Compliance requirements - RITC ${ritc}`} width={560} onClose={() => setCcrItem(null)}
      description="From the masters of this system (Tariff, Export Policy, RoDTEP, Drawback). Restricted / prohibited goods need a licence or permission document (add it in e-Sanchit)."
    >
      {facts.map(([label, value]) => (
        <div key={label} className="tw:flex tw:gap-2 tw:border-b tw:border-border tw:py-1.5">
          <span className="tw:w-[150px] tw:shrink-0 tw:font-semibold tw:text-muted-foreground">{label}</span>
          <span className={cn('tw:flex-1 tw:font-semibold', label === POLICY_LABEL && restricted ? 'tw:text-destructive' : 'tw:text-foreground')}>{value}</span>
        </div>
      ))}
    </Modal>
  );
}
