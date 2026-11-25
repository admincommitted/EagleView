import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { errorMessage } from '@/services/axiosInstance';
import { rgbColorsForHtml2canvas } from '@/lib/cssColors';
import { Button } from '@/components/ui';
import { purchaseApi } from './PurchaseParts/purchaseApi';
import MaterialReceivedNote from './PurchaseParts/MaterialReceivedNote';
import PurchaseOrderDocument from './PurchaseParts/PurchaseOrderDocument';
import { branchRows } from './PurchaseParts/purchaseFormat';

// The head comes from Settings > Company Profile and the PO's branch in Branch Master; where those are empty the
// details printed on the company's tax invoice are used.
const INVOICE_HEAD = {
  name: 'COMMITTED CARGO CARE LIMITED', address1: 'A-406, Road No. 4, Street No. 8, Mahipalpur Extn.', address2: 'New Delhi - 110037, India',
  phone: '011-46151111', email: 'admin@committedcargo.com', gstin: '07AAACC6689E1ZJ', pan: 'AAACC6689E', cin: 'U63090DL1998PLC096746',
};

const PDF_OPTIONS = {
  margin: 0.5,
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, ...rgbColorsForHtml2canvas },
  jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
};

const filled = (value) => (value != null && String(value).trim() !== '' ? String(value).trim() : '');

const dayMonthYear = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

const sameName = (first, second) => first && second && String(first).toUpperCase() === String(second).toUpperCase();

function poBranch(branches, branchName) {
  return branches.find((branch) => [branch.branchName, branch.branchCode, branch.icaffeCode].some((name) => sameName(name, branchName)))
    || branches.find((branch) => branch.isDefault)
    || {};
}

function letterHead(company, branch) {
  const companyAddress = [filled(company.address1), filled(company.address2)].filter(Boolean).join(', ');
  const companyCity = [filled(company.city), filled(company.pincode)].filter(Boolean).join(' - ');
  return {
    name: filled(company.legalName) || filled(company.companyName) || INVOICE_HEAD.name,
    line1: companyAddress || INVOICE_HEAD.address1,
    line2: companyAddress ? [companyCity, filled(company.state), filled(company.country)].filter(Boolean).join(', ') : INVOICE_HEAD.address2,
    gstin: filled(company.gstin) || filled(branch.gstin) || INVOICE_HEAD.gstin,
    pan: filled(company.pan) || INVOICE_HEAD.pan,
    cin: filled(company.cin) || INVOICE_HEAD.cin,
    phone: filled(company.phone) || filled(branch.phone) || INVOICE_HEAD.phone,
    email: filled(company.email) || filled(branch.email) || INVOICE_HEAD.email,
  };
}

export default function POView() {
  const { id } = useParams();
  const [po, setPo] = useState(null);
  const [company, setCompany] = useState({});
  const [branches, setBranches] = useState([]);
  const sheetRef = useRef(null);

  useEffect(() => {
    const loadPurchaseOrder = async () => {
      try {
        setPo(await purchaseApi.purchaseOrder(id));
      } catch (error) {
        console.error(errorMessage(error));
      }
    };
    loadPurchaseOrder();
  }, [id]);

  useEffect(() => {
    const loadCompany = async () => {
      try {
        setCompany((await purchaseApi.companyProfile())?.data || {});
      } catch {
        // the tax-invoice head is used
      }
    };
    const loadBranches = async () => {
      try {
        setBranches(branchRows(await purchaseApi.companyBranches()));
      } catch {
        // the tax-invoice head is used
      }
    };
    loadCompany();
    loadBranches();
  }, []);

  if (!po) return <div>Loading...</div>;

  const branch = poBranch(branches, po.branch);
  const head = letterHead(company, branch);
  const shipAddress = filled(branch.address) || [head.line1, head.line2].join(', ');
  const downloadPdf = () => html2pdf().set({ ...PDF_OPTIONS, filename: `${po.poNumber}.pdf` }).from(sheetRef.current).save();

  return (
    <div className="tw:mx-auto tw:flex tw:max-w-[800px] tw:flex-col tw:gap-5 tw:p-3 tw:md:p-5">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
        <h2 className="tw:m-0 tw:text-lg tw:font-bold">PO Details: {po.poNumber}</h2>
        <Button variant="default" size="lg" onClick={downloadPdf}><Download /> Download PDF</Button>
      </div>

      <PurchaseOrderDocument po={po} head={head} shipAddress={shipAddress} issuedOn={dayMonthYear(po.createdAt)} sheetRef={sheetRef} />

      {po.status === 'Approved' && <MaterialReceivedNote />}
    </div>
  );
}
