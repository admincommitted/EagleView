// DOCUMENTS menu of the AWB / MAWB / HAWB screens. The documents its special handling codes call for are marked
// "needed". Every window fills itself from the saved AWB.
import { Fragment } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui';

const DOCUMENT_GROUPS = [
  { title: 'Shipment', documents: [
    { key: 'sli', label: "Shipper's Letter of Instruction (SLI)", opener: 'setShowSli' },
    { key: 'booking', label: 'Booking confirmation', opener: 'setShowBooking' },
    { key: 'label', label: 'Cargo labels (with barcode)', opener: 'setShowLabel' },
    { key: 'manifest', label: 'Cargo manifest (consol)', opener: 'setShowManifest' },
  ] },
  { title: 'Declarations', documents: [
    { key: 'csd', label: 'Consignment security declaration (CSD)', opener: 'setShowCsd' },
    { key: 'ecsd', label: 'e-CSD (export)', opener: null },
    { key: 'dgd', label: "Shipper's declaration - dangerous goods", opener: 'setShowDgd' },
    { key: 'lithium', label: 'Lithium battery declaration', opener: 'setShowLithium' },
    { key: 'avi', label: 'Live animals certification', opener: 'setShowAvi' },
    { key: 'temp', label: 'Temperature control instructions', opener: 'setShowTemp' },
  ] },
  { title: 'Other', documents: [
    { key: 'coo', label: 'Certificate of origin', opener: 'setShowCoo' },
    { key: 'cca', label: 'Cargo charges correction advice (CCA)', opener: 'setShowCca' },
    { key: 'do', label: 'Delivery order', opener: 'setShowDo' },
  ] },
];

// which special handling codes call for which document
const CODES_NEEDING = {
  dgd: ['DGR', 'RCL', 'RCM', 'RCX', 'RFL', 'RFS', 'RFW', 'RIS', 'RMD', 'RNG', 'ROP', 'ROX', 'RPB', 'RPG', 'RRW', 'RRY', 'RRE', 'RSB', 'RSC', 'RXB', 'RXC', 'RXD', 'RXE', 'RXG', 'RXS', 'CAO', 'ICE'],
  lithium: ['ELI', 'ELM', 'RLI', 'RLM'],
  avi: ['AVI'],
  temp: ['COL', 'CRT', 'ERT', 'FRO', 'ICE', 'PIL', 'PER', 'ACT'],
};

const handlingCodesOf = (sphCodes) => {
  const codes = Array.isArray(sphCodes) ? sphCodes : String(sphCodes || '').split(/[\s,]+/);
  return new Set(codes.map((code) => String(code || '').toUpperCase()).filter(Boolean));
};

export default function DocumentsMenu({ ctx, type }) {
  const handlingCodes = handlingCodesOf(ctx.sphCodes);
  const isNeeded = (key) => (CODES_NEEDING[key] || []).some((code) => handlingCodes.has(code));
  const anyNeeded = Object.keys(CODES_NEEDING).some(isNeeded);

  const openDocument = ({ key, opener }) => {
    if (key === 'ecsd') {
      try {
        localStorage.setItem('ecsd_data', JSON.stringify({ awbPrefix: ctx.awbPrefix || '', awbSuffix: ctx.awbSuffix || '', dep: ctx.depAirport || '', dest: ctx.destAirport || '', nature: ctx.natureOfGoods || '' }));
      } catch {
        // the e-CSD screen then starts empty
      }
      if (ctx.navigate) ctx.navigate('/freight/ecsd');
      return;
    }
    if (typeof ctx[opener] === 'function') ctx[opener](true);
  };

  const shownDocuments = (documents) => documents.filter(({ key }) => !(key === 'manifest' && type === 'AWB'));

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="lg"
          title={anyNeeded ? 'The special handling codes of this AWB need a declaration - see the marked documents' : 'Documents of this AWB, filled from the saved AWB'}
          className={cn('tw:font-bold', anyNeeded && 'tw:border-warning tw:bg-warning tw:text-white tw:hover:bg-warning/85')}
        >
          DOCUMENTS <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="tw:w-[300px] tw:max-w-[calc(100vw-32px)] tw:normal-case">
        {!ctx.currentAwbId && (
          <DropdownMenuLabel className="tw:text-[11px] tw:font-normal tw:text-warning">Save the AWB first - the documents are filled from the saved AWB.</DropdownMenuLabel>
        )}
        {DOCUMENT_GROUPS.map((group, groupIndex) => (
          <Fragment key={group.title}>
            {groupIndex > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="tw:pb-0.5 tw:text-[10px] tw:font-extrabold tw:tracking-wide tw:text-muted-foreground">{group.title}</DropdownMenuLabel>
            {shownDocuments(group.documents).map((documentItem) => (
              <DropdownMenuItem key={documentItem.key} onSelect={() => openDocument(documentItem)}>
                <span className="tw:flex-1">{documentItem.label}{documentItem.key === 'manifest' && type === 'HAWB' ? ' - of its MAWB' : ''}</span>
                {isNeeded(documentItem.key) && <Badge variant="warning">needed</Badge>}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
