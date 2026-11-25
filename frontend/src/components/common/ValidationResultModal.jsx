// ICEGATE pre-validation result: errors block sending, warnings can be accepted.
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Modal } from '@/components/ui';

const TONES = {
  error: { heading: 'tw:text-destructive', box: 'tw:bg-destructive/10' },
  warning: { heading: 'tw:text-warning', box: 'tw:bg-warning/10' },
};

// "Invoice 1: Currency missing" -> grouped under "Invoice 1"
const groupByPlace = (lines) => lines.reduce((groups, line) => {
  const colon = line.indexOf(': ');
  const place = colon > 0 ? line.slice(0, colon) : 'General';
  (groups[place] = groups[place] || []).push(colon > 0 ? line.slice(colon + 2) : line);
  return groups;
}, {});

function ProblemList({ title, lines, tone, icon: Icon }) {
  if (!lines.length) return null;
  return (
    <div className="tw:mb-3">
      <div className={cn('tw:mb-1.5 tw:flex tw:items-center tw:gap-1.5 tw:text-[13px] tw:font-bold', TONES[tone].heading)}>
        <Icon className="tw:size-4" /> {title} ({lines.length})
      </div>
      {Object.entries(groupByPlace(lines)).map(([place, messages]) => (
        <div key={place} className={cn('tw:mb-1.5 tw:rounded-md tw:px-2.5 tw:py-1.5', TONES[tone].box)}>
          <div className="tw:font-bold tw:text-foreground">{place}</div>
          <ul className="tw:mt-1 tw:mb-0 tw:ml-[18px] tw:p-0 tw:text-foreground">
            {messages.map((message, index) => <li key={index}>{message}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function ValidationResultModal({ result, onClose }) {
  if (!result) return null;
  const errors = result.errors || [];
  const warnings = result.warnings || [];
  const canContinue = errors.length === 0 && typeof result.onContinue === 'function';

  const continueSending = () => {
    const goOn = result.onContinue;
    onClose();
    goOn();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={result.title || 'ICEGATE Pre-Validation'}
      width={640}
      closeOnOutside={false}
      bodyClassName="tw:max-h-[70vh]"
      footer={(
        <>
          <Button onClick={onClose}>{canContinue ? 'Cancel' : 'Close'}</Button>
          {canContinue && (
            <Button variant="default" onClick={continueSending}>
              {result.continueLabel || (warnings.length ? 'Continue anyway' : 'Continue')}
            </Button>
          )}
        </>
      )}
    >
      {errors.length === 0 && warnings.length === 0 && (
        <div className="tw:flex tw:items-center tw:gap-1.5 tw:font-bold tw:text-success"><CheckCircle className="tw:size-4" /> No problems found.</div>
      )}
      <ProblemList title="Errors - fix before sending" lines={errors} tone="error" icon={XCircle} />
      <ProblemList title="Warnings - please check" lines={warnings} tone="warning" icon={AlertTriangle} />
    </Modal>
  );
}
