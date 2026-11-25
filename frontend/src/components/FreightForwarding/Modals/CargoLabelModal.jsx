// Cargo labels, one per piece, from the saved AWB: airline, AWB number with a scannable Code 39 barcode (AWB number +
// piece number), destination, total pieces, weight and the HAWB. A MAWB with houses gives each house's pieces their own labels.
import { useState } from 'react';
import { Input } from '@/components/ui';
import DocumentModal from './DocumentModal';
import { Barcode39 } from './docKit';
import { kg } from './docFormat';

const LABEL_LIMIT = 500;

function CargoLabel({ doc, label }) {
  const awb = doc.mawbNo || '';
  return (
    <div className="keep tw:box-border tw:flex tw:h-[250px] tw:break-inside-avoid tw:flex-col tw:border-2 tw:border-solid tw:border-black tw:px-[10px] tw:py-[8px]">
      <div className="tw:flex tw:items-baseline tw:justify-between tw:border-0 tw:border-b-2 tw:border-solid tw:border-black tw:pb-[3px]">
        <b className="tw:text-[14px]">{doc.airline.name || 'AIRLINE'}</b><span className="tw:text-[11px]">{doc.airline.code}</span>
      </div>
      <div className="tw:mt-[4px] tw:text-center tw:text-[10px]">AIR WAYBILL No.</div>
      <div className="tw:text-center tw:text-[26px] tw:font-bold tw:tracking-[1px]">{awb || '___-________'}</div>
      <div className="tw:mt-[2px] tw:mb-[4px]">{awb && <Barcode39 value={`${awb.replace(/\D/g, '')}${String(label.piece).padStart(5, '0')}`} height={38} unit={1.1} />}</div>
      <div className="tw:grid tw:flex-1 tw:grid-cols-3 tw:border-0 tw:border-t tw:border-solid tw:border-black tw:pt-[4px]">
        <div><div className="tw:text-[9px]">DESTINATION</div><div className="tw:text-[30px] tw:leading-none tw:font-bold">{label.destination || ''}</div></div>
        <div className="tw:text-center">
          <div className="tw:text-[9px]">PIECE / TOTAL</div><div className="tw:text-[20px] tw:font-bold">{label.piece} / {label.pieces}</div>
          {doc.pieces !== label.pieces && <div className="tw:text-[9px]">AWB total {doc.pieces}</div>}
        </div>
        <div className="tw:text-right"><div className="tw:text-[9px]">TOTAL WT (KG)</div><div className="tw:text-[16px] tw:font-bold">{kg(label.weight)}</div></div>
      </div>
      <div className="tw:flex tw:justify-between tw:border-0 tw:border-t tw:border-solid tw:border-black tw:pt-[3px] tw:text-[11px]">
        <span>ORIGIN <b>{doc.origin.code}</b></span>
        {label.hawb && <span>HAWB <b className="tw:text-[13px]">{label.hawb}</b></span>}
      </div>
    </div>
  );
}

// one group per house (MAWB with houses), else the AWB / HAWB itself
const pieceGroups = (doc) => ((doc.houses || []).length
  ? doc.houses.map((house) => ({ hawb: house.hawb, pieces: house.pieces || 1, weight: house.gross, destination: house.destination || doc.destination.code }))
  : [{ hawb: doc.hawbNo, pieces: parseInt(doc.pieces, 10) || 1, weight: doc.gross, destination: doc.destination.code }]);

function labelBlocks(doc, maxPerGroup) {
  if (!doc.mawbNo) {
    return [<div key="unsaved" className="tw:p-[30px] tw:text-center tw:text-[#64748b]">Save the AWB first - the labels are made from its number, pieces and destination.</div>];
  }
  const groups = pieceGroups(doc);
  const limit = Number(maxPerGroup) || LABEL_LIMIT;
  const labels = groups.flatMap((group) => Array.from({ length: Math.max(0, Math.min(group.pieces, limit)) }, (_, index) => ({ ...group, piece: index + 1 })));
  return [
    <div key="summary" className="tw:mb-[6px] tw:text-[10px] tw:text-[#64748b]">
      {labels.length} label(s): {groups.map((group) => `${group.hawb ? 'HAWB ' + group.hawb + ': ' : ''}${group.pieces} pcs`).join(', ')}. Barcode = AWB number + piece number.
    </div>,
    <div key="labels" className="tw:grid tw:grid-cols-2 tw:gap-[10px]">
      {labels.map((label, index) => <CargoLabel key={index} doc={doc} label={label} />)}
    </div>,
  ];
}

export default function CargoLabelModal(props) {
  const [maxPerGroup, setMaxPerGroup] = useState('');
  const sheet = { title: 'Cargo Labels', filePrefix: 'Labels', blocks: (doc) => labelBlocks(doc, maxPerGroup) };
  const limitBox = (
    <label className="tw:flex tw:items-center tw:gap-[4px] tw:text-entry">
      Labels per piece up to
      <Input value={maxPerGroup} onChange={(event) => setMaxPerGroup(event.target.value.replace(/\D/g, ''))} placeholder="all" className="tw:w-[50px]" />
    </label>
  );
  return <DocumentModal {...props} sheet={sheet} extraButtons={limitBox} />;
}
