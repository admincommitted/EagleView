import { Globe, Server } from 'lucide-react';
import { Badge, Field, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { DESCARTES_ERROR_CODES, DESCARTES_SESSION_LOGS } from '../helpers';
import StepCard from './StepCard';
import GenerateKeyWarningModal from './GenerateKeyWarningModal';

const SESSION_LOG_CARDS = [
  { url: DESCARTES_SESSION_LOGS.test, label: '🧪 TEST Session Log', host: 'wwwtest.myvan.descartes.com', tone: 'tw:border-primary/30 tw:bg-primary/10 tw:text-primary' },
  { url: DESCARTES_SESSION_LOGS.production, label: '🚀 PRODUCTION Session Log', host: 'ftp.myvan.descartes.com', tone: 'tw:border-success/30 tw:bg-success/10 tw:text-success' },
];

const SESSION_LOG_LINKS = [
  { url: DESCARTES_SESSION_LOGS.test, label: '🧪 TEST Environment', text: 'wwwtest.myvan.descartes.com → SFTP Sessions' },
  { url: DESCARTES_SESSION_LOGS.production, label: '🚀 PRODUCTION Environment', text: 'www.myvan.descartes.com → SFTP Sessions' },
];

const EXTERNAL_LINK = { target: '_blank', rel: 'noopener noreferrer' };

function SessionLogCard({ card }) {
  return (
    <a href={card.url} {...EXTERNAL_LINK}
      className={cn('tw:flex tw:flex-col tw:gap-1.5 tw:rounded-lg tw:border tw:p-3.5 tw:no-underline tw:transition-shadow tw:hover:shadow-md', card.tone)}>
      <span className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span className="tw:text-[11px] tw:font-extrabold tw:tracking-wide tw:uppercase">{card.label}</span>
        <span className="tw:text-[10px] tw:opacity-70">↗ Open</span>
      </span>
      <span className="tw:font-mono tw:text-[10px] tw:break-all">{card.host}</span>
      <span className="tw:text-[11px] tw:text-foreground">Check SFTP session logs, file upload status, error codes</span>
    </a>
  );
}

function SessionLogLink({ link }) {
  return (
    <div className="tw:rounded-md tw:border tw:border-warning/30 tw:bg-card tw:p-2.5">
      <div className="tw:mb-1 tw:text-[10px] tw:font-bold tw:text-head">{link.label}</div>
      <a href={link.url} {...EXTERNAL_LINK} className="tw:font-mono tw:text-[10px] tw:break-all tw:text-primary">{link.text}</a>
      <div className="tw:mt-1 tw:text-[9px] tw:text-muted-foreground">Shows upload/download history. Requires successful authentication.</div>
    </div>
  );
}

const ERROR_TONE_BADGE = { success: 'success', danger: 'danger', warning: 'warning' };

export default function DescartesSelfDiagnosticsSection({ ctx }) {
  const { form, handleChange } = ctx;
  return (
    <>
      <StepCard icon={Globe} title="Descartes Self-Diagnostics (FAQ Q31)">
        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-2">
          {SESSION_LOG_CARDS.map((card) => <SessionLogCard key={card.url} card={card} />)}
        </div>

        <div className="tw:rounded-md tw:border tw:border-border tw:bg-card tw:px-3.5 tw:py-3">
          <div className="tw:mb-2 tw:text-[11px] tw:font-bold tw:tracking-wide tw:text-muted-foreground tw:uppercase">Quick Reference — Descartes Error Codes</div>
          <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] tw:gap-1.5">
            {DESCARTES_ERROR_CODES.map((error) => (
              <div key={error.code} className="tw:flex tw:items-center tw:gap-2">
                <Badge variant={ERROR_TONE_BADGE[error.tone]} className="tw:min-w-6 tw:rounded-sm">{error.code}</Badge>
                <span className="tw:text-[11px] tw:text-foreground">{error.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-4 tw:gap-y-1 tw:text-[11px] tw:text-muted-foreground">
          <span>📧 Support: <a href="mailto:info@descartes.com" className="tw:text-primary">info@descartes.com</a></span>
          <span>👤 Contact: <a href="mailto:dliu@descartes.com" className="tw:text-primary">Dejin Liu (dliu@descartes.com)</a></span>
        </div>
      </StepCard>

      <StepCard icon={Server} title="Step 5 — Company / Sender Info">
        <Field layout="col" labelClassName="tw:whitespace-normal"
          label={<>Company Name <span className="tw:text-muted-foreground tw:normal-case">(used in XFZB Consignment Security Declaration)</span></>}>
          <Input name="company_name" data-allow-text value={form.company_name} onChange={handleChange} placeholder="e.g. COMMITTED CARGO CARE PVT LTD" className="tw:uppercase" />
        </Field>
      </StepCard>

      <div className="tw:flex tw:flex-col tw:gap-2.5 tw:rounded-lg tw:border tw:border-warning/40 tw:bg-warning/10 tw:p-3 tw:md:p-4">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <Globe className="tw:size-3.5 tw:text-warning" />
          <span className="tw:text-entry tw:font-bold tw:tracking-wide tw:text-warning tw:uppercase">Descartes Self-Diagnostics (FAQ Q31)</span>
          <span className="tw:text-[10px] tw:text-muted-foreground tw:normal-case">Check SFTP session logs on Descartes server after upload attempts</span>
        </div>
        <div className="tw:grid tw:grid-cols-1 tw:gap-2.5 tw:md:grid-cols-2">
          {SESSION_LOG_LINKS.map((link) => <SessionLogLink key={link.url} link={link} />)}
        </div>
        <div className="tw:rounded-sm tw:bg-warning/10 tw:px-2 tw:py-1.5 tw:text-[9px] tw:text-warning">
          ⚠ <strong>Important (FAQ Q23):</strong> Max 4 simultaneous sessions from same IP. Do not poll more than once per 5 minutes. Violations result in 15-minute IP block.
          &nbsp;|&nbsp; <strong>File limit (FAQ Q32):</strong> 1 MB per file. Send smaller files more frequently.
        </div>
      </div>

      <GenerateKeyWarningModal ctx={ctx} />
    </>
  );
}
