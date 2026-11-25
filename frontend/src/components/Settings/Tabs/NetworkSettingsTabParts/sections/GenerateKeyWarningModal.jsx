import { Key } from 'lucide-react';
import { Button, Input, Label, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';

const CONFIRM_WORD = 'CONFIRM';

export default function GenerateKeyWarningModal({ ctx }) {
  const { closeKeyWarning, confirmText, handleGenerateKey, setConfirmText, showKeyWarning } = ctx;
  const confirmed = confirmText === CONFIRM_WORD;

  const footer = (
    <>
      <Button onClick={closeKeyWarning}>Cancel — Keep Existing Key</Button>
      <Button variant="destructive" onClick={handleGenerateKey} disabled={!confirmed}><Key /> Yes, Generate New Key</Button>
    </>
  );

  return (
    <Modal open={showKeyWarning} onClose={closeKeyWarning} width={480} closeOnOutside={false} footer={footer}
      title={<span className="tw:text-destructive">⚠️ WARNING — Generating a New SSH Key</span>} description="This action cannot be undone">
      <div className="tw:flex tw:flex-col tw:gap-4 tw:normal-case">
        <div className="tw:rounded-md tw:border tw:border-destructive/40 tw:bg-destructive/10 tw:px-3.5 tw:py-3 tw:text-entry tw:text-destructive">
          <div className="tw:mb-2 tw:font-bold">What will happen:</div>
          <ul className="tw:m-0 tw:pl-4.5 tw:leading-loose">
            <li>A <strong>new RSA 4096-bit key pair</strong> will be generated</li>
            <li>The <strong>old private key will be permanently replaced</strong> in the database</li>
            <li>The old public key registered with <strong>Descartes will stop working</strong></li>
            <li>You must <strong>email the new public key to Descartes</strong> and wait for re-registration before SFTP will work again</li>
          </ul>
        </div>

        <div className="tw:rounded-md tw:border tw:border-warning/40 tw:bg-warning/10 tw:px-3 tw:py-2 tw:text-[11px] tw:text-warning">
          💡 <strong>Only proceed if:</strong> You are setting up for the first time, or Descartes has asked you to rotate your key.
          <br />
          <strong>Do NOT proceed</strong> if SFTP is already working — you will break the connection.
        </div>

        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <Label htmlFor="ssh-key-confirm" className="tw:font-bold">
            Type <code className="tw:rounded-sm tw:bg-secondary tw:px-1 tw:text-destructive">{CONFIRM_WORD}</code> to proceed:
          </Label>
          <Input id="ssh-key-confirm" autoFocus data-allow-text value={confirmText} placeholder="Type CONFIRM here"
            onChange={(event) => setConfirmText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && confirmed) handleGenerateKey(); }}
            className={cn('tw:h-8 tw:border-2 tw:font-mono tw:text-[13px]', confirmed && 'tw:border-success tw:bg-success/10 tw:text-success')} />
        </div>
      </div>
    </Modal>
  );
}
