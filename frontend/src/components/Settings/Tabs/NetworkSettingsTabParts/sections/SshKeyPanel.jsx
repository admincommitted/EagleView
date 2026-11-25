import { CheckCircle, ChevronDown, ChevronUp, Copy, Download, Key } from 'lucide-react';
import { Button, Field, Input, Label, Textarea } from '@/components/ui';
import { MASKED, downloadText } from '../helpers';

const MASKED_KEY_TEXT = '*** (key saved in database — use Download buttons above)';
const PRIVATE_KEY_PLACEHOLDER = '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----';

function GeneratedPublicKey({ generatedKey, copied, onCopy }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5 tw:rounded-md tw:border tw:border-success/30 tw:bg-success/10 tw:p-2.5">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
        <span className="tw:text-[11px] tw:font-bold tw:text-success">📤 PUBLIC KEY — Send this to Descartes to register</span>
        <div className="tw:flex tw:flex-wrap tw:gap-1">
          <Button size="sm" variant={copied ? 'success' : 'default'} onClick={onCopy}><Copy /> {copied ? 'Copied!' : 'Copy'}</Button>
          <Button size="sm" onClick={() => downloadText(generatedKey.publicKey, 'descartes_id_rsa.pub')}><Download /> .pub File</Button>
          {generatedKey.privateKeyPem && (
            <Button size="sm" variant="warning" onClick={() => downloadText(generatedKey.privateKeyPem, 'descartes_id_rsa.pem')}><Download /> Private Backup</Button>
          )}
        </div>
      </div>
      <Textarea readOnly value={generatedKey.publicKey} rows={2} className="tw:resize-none tw:bg-background tw:font-mono tw:text-[9px] tw:text-success" />
      <div className="tw:text-[9px] tw:text-muted-foreground">⚠ Private key has been saved to the database automatically. Download a backup copy for safekeeping.</div>
    </div>
  );
}

function SavedKeyNotice() {
  return (
    <div className="tw:flex tw:items-center tw:gap-2.5 tw:rounded-md tw:border tw:border-success/40 tw:bg-success/10 tw:px-4 tw:py-3.5">
      <CheckCircle className="tw:size-4 tw:shrink-0 tw:text-success" />
      <div className="tw:flex-1">
        <div className="tw:text-entry tw:font-bold tw:text-success">SSH Key is saved in the database</div>
        <div className="tw:mt-0.5 tw:text-[10px] tw:text-success">
          Use the buttons above to download the Public Key (.pub) to send to Descartes, or backup the Private Key (.pem).
        </div>
      </div>
    </div>
  );
}

function PowerShellInstructions() {
  return (
    <div className="tw:rounded-sm tw:bg-slate-800 tw:px-3 tw:py-2.5 tw:font-mono tw:text-[10px] tw:leading-[1.8] tw:break-all tw:text-slate-200">
      <div className="tw:text-slate-400"># Run in PowerShell (press Enter when asked for passphrase to leave blank):</div>
      <div className="tw:text-green-300">ssh-keygen -t rsa -b 4096 -C &quot;descartes&quot; -f &quot;$env:USERPROFILE\.ssh\descartes_id_rsa&quot;</div>
      <div className="tw:text-slate-400"># Copy the public key to send to Descartes:</div>
      <div className="tw:text-green-300">type &quot;$env:USERPROFILE\.ssh\descartes_id_rsa.pub&quot;</div>
    </div>
  );
}

export default function SshKeyPanel({ ctx }) {
  const { copied, downloadingBackup, downloadingPubKey, form, generatedKey, generating, handleChange, handleCopyPublicKey, handleDownloadPrivateKeyBackup, handleDownloadPublicKey, hasKeyInDb, openKeyWarning, setShowInstructions, showInstructions } = ctx;
  const changePrivateKey = (event) => { if (!event.target.value.startsWith(MASKED)) handleChange(event); };

  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:px-3 tw:py-4 tw:md:px-5">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5">
        <Key className="tw:size-4 tw:text-primary" />
        <span className="tw:text-entry tw:font-bold tw:text-head">SSH PRIVATE KEY</span>
        <span className="tw:text-[11px] tw:text-muted-foreground">(RSA 4096-bit — shared for both Test and Production)</span>
      </div>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button variant="success" onClick={handleDownloadPublicKey} disabled={downloadingPubKey}>
          <Download /> {downloadingPubKey ? 'Deriving...' : 'Download Public Key (.pub)'}
        </Button>
        <Button variant="warning" onClick={handleDownloadPrivateKeyBackup} disabled={downloadingBackup}>
          <Download /> {downloadingBackup ? 'Downloading...' : 'Download Private Key Backup'}
        </Button>
        <Button variant="default" onClick={openKeyWarning} disabled={generating}>
          <Key /> {generating ? 'Generating...' : 'Generate New Key (RSA 4096)'}
        </Button>
      </div>

      {generatedKey && <GeneratedPublicKey generatedKey={generatedKey} copied={copied} onCopy={handleCopyPublicKey} />}
      {hasKeyInDb && !generatedKey && <SavedKeyNotice />}

      <Field layout="col" label="Private Key — paste manually or generate above:" labelClassName="tw:whitespace-normal tw:font-semibold tw:text-head">
        <Textarea name="sftp_private_key" rows={5} placeholder={PRIVATE_KEY_PLACEHOLDER} className="tw:font-mono tw:text-[10px]"
          value={form.sftp_private_key === MASKED ? MASKED_KEY_TEXT : form.sftp_private_key} onChange={changePrivateKey} />
      </Field>

      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:flex-wrap tw:md:items-center tw:md:justify-between">
        <div className="tw:flex tw:flex-col tw:gap-1 tw:sm:flex-row tw:sm:items-center tw:sm:gap-2">
          <Label htmlFor="sftp-passphrase">Passphrase (optional):</Label>
          <Input id="sftp-passphrase" type="password" name="sftp_passphrase" value={form.sftp_passphrase} onChange={handleChange}
            placeholder="Only if key is encrypted" className="tw:w-full tw:sm:w-[200px]" />
        </div>
        <Button variant="link" className="tw:self-start tw:text-[10px]" onClick={() => setShowInstructions((shown) => !shown)}>
          {showInstructions ? <ChevronUp /> : <ChevronDown />} How to generate manually via PowerShell?
        </Button>
      </div>

      {showInstructions && <PowerShellInstructions />}
    </div>
  );
}
