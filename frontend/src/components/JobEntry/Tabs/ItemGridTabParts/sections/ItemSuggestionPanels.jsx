import { X } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

const PANEL_TONES = {
  history: { frame: 'tw:border-primary/30 tw:bg-primary/5', head: 'tw:border-primary/20 tw:text-head' },
  exemption: { frame: 'tw:border-warning/40 tw:bg-warning/10', head: 'tw:border-warning/30 tw:text-warning' },
};

const dayMonthYear = (date) => String(date || '').slice(0, 10).split('-').reverse().join('-');
const percentOrDash = (rate) => (rate === null || rate === undefined || rate === '' ? '-' : `${rate}%`);

function SuggestionPanel({ tone, title, subtitle, onHide, children }) {
  const colours = PANEL_TONES[tone];
  return (
    <div className={cn('tw:mb-1.5 tw:rounded-sm tw:border tw:text-entry', colours.frame)}>
      <div className={cn('tw:flex tw:items-center tw:gap-2 tw:border-b tw:px-2 tw:py-0.5 tw:font-bold', colours.head)}>
        <span>{title}</span>
        <span className="tw:font-normal">{subtitle}</span>
        <Button variant="ghost" size="icon-sm" className="tw:ml-auto" title="Hide" aria-label="Hide" onClick={onHide}><X /></Button>
      </div>
      {children}
    </div>
  );
}

function SuggestionRow({ onUse, children }) {
  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5 tw:border-t tw:border-border/60 tw:px-2 tw:py-1 tw:first:border-t-0">
      <Button variant="default" size="sm" onClick={onUse}>Use</Button>
      {children}
    </div>
  );
}

function historyMatchText(option) {
  if (option.scope === 'others') return `Other client${option.importer ? `: ${option.importer}` : ''}`;
  if (option.matchedBy === 'similar') return 'This importer - description starts the same';
  if (option.matchedBy === 'model') return 'This importer - same model no';
  return 'This importer - same description';
}

function igstText(igst) {
  if (!igst || igst.rate === '') return '-';
  return `${igst.rate}%${igst.srNo ? ` (${igst.notnNo} Sl ${igst.srNo})` : ''}`;
}

/** What earlier jobs used for this product (ctx.itemHistory from hooks/useTariffLookup askItemHistory). */
export function ItemHistoryPanel({ history, onUse, onHide }) {
  if (!history || history.options.length === 0) return null;
  const subtitle = history.options.length > 1
    ? 'Earlier jobs used more than one heading - pick the right one.'
    : 'Only blank boxes are filled; nothing is saved before SAVE / MODIFY.';
  return (
    <SuggestionPanel tone="history" title="Last used for this product" subtitle={subtitle} onHide={onHide}>
      {history.options.map((option, index) => {
        const fields = option.fields || {};
        const lastJobDate = dayMonthYear(option.lastJobDate);
        const otherMatch = option.scope === 'others' || option.matchedBy !== 'description';
        return (
          <SuggestionRow key={index} onUse={() => onUse(option)}>
            <span className="tw:font-extrabold tw:tracking-wide">RITC {fields.ritc}</span>
            <span>BCD {percentOrDash(fields.bcdRate)}</span>
            <span>IGST {igstText(fields.igstData)}</span>
            {fields.uqc ? <span>UQC {fields.uqc}</span> : null}
            {option.lastPrice ? <span title="Unit price of the earlier entry - shown only, not filled">last price {option.lastPrice} {option.lastCurrency || ''}</span> : null}
            <span className={cn('tw:font-semibold', otherMatch ? 'tw:text-warning' : 'tw:text-success')}>{historyMatchText(option)}</span>
            <span className="tw:text-muted-foreground">
              {option.count} time(s) in {option.jobs} job(s), last job {option.lastJobNo}{lastJobDate ? ` of ${lastJobDate}` : ''}
            </span>
            {option.matchedBy === 'similar' || option.scope === 'others'
              ? <span className="tw:max-w-[420px] tw:truncate tw:text-muted-foreground" title={option.description}>"{option.description}"</span>
              : null}
          </SuggestionRow>
        );
      })}
    </SuggestionPanel>
  );
}

/** BCD exemption / concession notifications for the RITC (ctx.bcdExemptions from hooks/useTariffLookup askBcdExemptions). */
export function BcdExemptionsPanel({ exemptions, onUse, onHide }) {
  if (!exemptions || exemptions.options.length === 0) return null;
  const { ritc, tariffBcd, itemsFiled, options, also } = exemptions;
  const subtitle = `${tariffBcd === null ? '' : `Tariff rate ${tariffBcd}%. `}`
    + `${itemsFiled ? `${itemsFiled} item(s) of this RITC in earlier jobs.` : 'No earlier job has this RITC.'} An exemption has conditions - check them.`;
  return (
    <SuggestionPanel tone="exemption" title={`BCD notifications for RITC ${ritc}`} subtitle={subtitle} onHide={onHide}>
      {options.map((option, index) => {
        const lastUsed = dayMonthYear(option.lastUsed);
        const share = itemsFiled && option.used ? Math.round(option.used * 100 / itemsFiled) : 0;
        const countries = option.countries || [];
        return (
          <SuggestionRow key={index} onUse={() => onUse(option)}>
            <span className="tw:font-extrabold">{option.notifNo}{option.serialNo ? ` Sl ${option.serialNo}` : ''}</span>
            <span className="tw:font-bold">BCD {percentOrDash(option.rate)}</span>
            {option.used > 0
              ? <span className="tw:font-semibold tw:text-success">filed on {option.used} of {itemsFiled} item(s){share ? ` (${share}%)` : ''}, {option.importers} importer(s){lastUsed ? `, last ${lastUsed}` : ''}</span>
              : <span className="tw:font-semibold tw:text-warning">in the Notification master - not filed here yet</span>}
            {option.used > 0 && !option.inMaster ? <span className="tw:text-warning">not in the Notification master</span> : null}
            {option.conditionNo ? <span>condition {option.conditionNo}</span> : null}
            {countries.length > 0
              ? <span className="tw:text-warning">country notification ({countries.slice(0, 5).join(', ')}{countries.length > 5 ? ' ...' : ''}) - certificate of origin</span>
              : null}
            {option.description ? <span className="tw:max-w-[380px] tw:truncate tw:text-muted-foreground" title={option.description}>{option.description}</span> : null}
          </SuggestionRow>
        );
      })}
      {also.length > 0 && (
        <div className="tw:border-t tw:border-border/60 tw:px-2 tw:py-1 tw:text-muted-foreground">
          Also in the Notification master for this RITC (several serials - pick the serial from the notification): {also.map((entry) => `${entry.notifNo} (${entry.serials})`).join(', ')}
        </div>
      )}
    </SuggestionPanel>
  );
}
