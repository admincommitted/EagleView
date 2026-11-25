import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const emptyDimension = () => ({ pieces: '', weight: '', length: '', width: '', height: '', volume: '', stackable: false, tiltable: false });
const VOLUME_FIELDS = ['pieces', 'length', 'width', 'height'];
const DIMENSION_FILE = /\.(xlsx|xls|csv|txt)$/i;

// Words that identify each column in an uploaded sheet (headings are compared lower case, letters only).
const COLUMN_WORDS = {
  pieces: ['piece', 'pcs', 'qty'],
  weight: ['weight', 'wt'],
  length: ['length', 'len'],
  width: ['width', 'breadth'],
  height: ['height', 'hgt'],
  volume: ['volume', 'cbm'],
  stackable: ['stack'],
  tiltable: ['tilt'],
};

export const hasDimensionContent = (dimension) => dimension.pieces || dimension.weight || dimension.volume;

const sumOf = (dimensions, field) => dimensions.reduce((sum, dimension) => sum + (parseFloat(dimension[field]) || 0), 0);

// cbm = L x W x H (cm) x pieces / 1,000,000, only when all four are filled
function cubicMetres(dimension) {
  const [pieces, length, width, height] = VOLUME_FIELDS.map((field) => parseFloat(dimension[field]) || 0);
  return pieces > 0 && length > 0 && width > 0 && height > 0 ? ((length * width * height * pieces) / 1000000).toFixed(3) : null;
}

const numberText = (value) => {
  const number = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? String(number) : '';
};
const isYes = (value) => /^(y|yes|true|1)$/i.test(String(value).trim());
const findColumn = (headings, words) =>
  headings.find((heading) => words.some((word) => String(heading).toLowerCase().replace(/[^a-z]/g, '').includes(word)));

function dimensionsFromSheet(sheetRows) {
  if (!sheetRows.length) throw new Error('that sheet has no rows');
  const headings = Object.keys(sheetRows[0]);
  const column = Object.fromEntries(Object.entries(COLUMN_WORDS).map(([field, words]) => [field, findColumn(headings, words)]));
  if (!column.pieces && !column.weight && !column.length) {
    throw new Error('no Pieces / Weight / Length column found. Headings seen: ' + headings.slice(0, 8).join(', '));
  }
  const numberAt = (sheetRow, field) => (column[field] ? numberText(sheetRow[column[field]]) : '');
  const flagAt = (sheetRow, field) => (column[field] ? isYes(sheetRow[column[field]]) : false);

  const dimensions = sheetRows.map((sheetRow) => {
    const dimension = {
      pieces: numberAt(sheetRow, 'pieces'),
      weight: numberAt(sheetRow, 'weight'),
      length: numberAt(sheetRow, 'length'),
      width: numberAt(sheetRow, 'width'),
      height: numberAt(sheetRow, 'height'),
      volume: numberAt(sheetRow, 'volume'),
      stackable: flagAt(sheetRow, 'stackable'),
      tiltable: flagAt(sheetRow, 'tiltable'),
    };
    if (!dimension.volume) dimension.volume = cubicMetres(dimension) || dimension.volume;
    return dimension;
  }).filter(hasDimensionContent);
  if (!dimensions.length) throw new Error('every row was empty');
  return dimensions;
}

const sheetRowOf = (dimension) => ({
  Pieces: dimension.pieces || '',
  'Weight (kg)': dimension.weight || '',
  'Length (cm)': dimension.length || '',
  'Width (cm)': dimension.width || '',
  'Height (cm)': dimension.height || '',
  'Volume (cbm)': dimension.volume || '',
  Stackable: dimension.stackable ? 'Y' : 'N',
  Tiltable: dimension.tiltable ? 'Y' : 'N',
});

export default function useDimensionLines(setValue) {
  const [dims, setDims] = useState(() => [emptyDimension()]);

  const totalPieces = sumOf(dims, 'pieces');
  const totalWeight = sumOf(dims, 'weight');
  const totalVolume = sumOf(dims, 'volume');

  useEffect(() => {
    if (dims.length > 0 && dims.some(hasDimensionContent)) {
      setValue('pieces', totalPieces || '');
      setValue('weight', totalWeight || '');
    }
  }, [totalPieces, totalWeight, totalVolume, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const addDim = () => setDims([...dims, emptyDimension()]);

  const removeDim = (index) => {
    if (dims.length > 1) setDims(dims.filter((_, position) => position !== index));
  };

  const updateDim = (index, field, value) => {
    const updated = { ...dims[index], [field]: value };
    if (VOLUME_FIELDS.includes(field)) updated.volume = cubicMetres(updated) || updated.volume;
    setDims(dims.map((dimension, position) => (position === index ? updated : dimension)));
  };

  const downloadDims = async (awbNumber) => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((dims.length ? dims : [{}]).map(sheetRowOf)), 'Dimensions');
    XLSX.writeFile(workbook, 'awb-dimensions-' + (awbNumber || 'new') + '.xlsx');
  };

  const uploadDims = async (file) => {
    if (!file) return;
    if (!DIMENSION_FILE.test(file.name)) {
      toast.error('Use an Excel or CSV file');
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      const dimensions = dimensionsFromSheet(sheetRows);
      setDims(dimensions);
      toast.success(dimensions.length + ' dimension line(s) loaded from ' + file.name);
    } catch (error) {
      toast.error('Could not read that file: ' + error.message);
    }
  };

  return { dims, totalPieces, totalWeight, totalVolume, addDim, removeDim, updateDim, downloadDims, uploadDims };
}
