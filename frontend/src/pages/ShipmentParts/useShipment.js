import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { askText } from '@/components/common/askConfirm';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { shipmentApi } from './shipmentApi';
import { DIVISION_BY_ROUTE, divisionLabels, emptyShipment, shipmentFromRecord } from './shipmentForm';

const errorNote = (error) => ({ tone: 'error', text: error.message });

// reads 'data.doNo' as shipment.data.doNo and 'mawbNo' as shipment.mawbNo
const readPath = (shipment, path) => (path.startsWith('data.') ? shipment.data[path.slice(5)] : shipment[path]);
const writePath = (shipment, path, value) => (path.startsWith('data.')
  ? { ...shipment, data: { ...shipment.data, [path.slice(5)]: value } }
  : { ...shipment, [path]: value });

export default function useShipment() {
  const { div: divisionParam } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const division = DIVISION_BY_ROUTE[String(divisionParam || 'ai').toLowerCase()] || 'AI';
  const activeBranch = useWorkspaceStore((state) => state.activeBranch);
  // 'All branches' in the top bar: the branch is picked on the form
  const myBranch = (activeBranch && !activeBranch.isAll && (activeBranch.branchCode || activeBranch.branch_code)) || '';

  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState('shipment');
  const [shipment, setShipment] = useState(() => emptyShipment(division, myBranch));
  const [shipmentId, setShipmentId] = useState(null);
  const [nextNo, setNextNo] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [invoices, setInvoices] = useState([]);

  const divisionInfo = meta
    ? meta.divisions[division]
    : { label: '', side: division.endsWith('I') ? 'Import' : 'Export', mode: division.startsWith('A') ? 'Air' : 'Sea' };
  const isImport = divisionInfo.side === 'Import';
  const isAir = divisionInfo.mode === 'Air';
  const labels = divisionLabels(isImport, isAir);
  const branch = shipment.branchCode || myBranch;

  useEffect(() => {
    const loadMeta = async () => {
      try {
        setMeta(await shipmentApi.meta());
      } catch (error) {
        setMessage(errorNote(error));
      }
    };
    loadMeta();
  }, []);

  useEffect(() => {
    setShipment(emptyShipment(division, myBranch));
    setShipmentId(null);
    setTab('shipment');
    setMessage(null);
  }, [division]); // eslint-disable-line react-hooks/exhaustive-deps -- a blank form only when the division changes

  useEffect(() => {
    if (shipmentId) return;
    const loadNextNo = async () => {
      try {
        const answer = await shipmentApi.nextNo(division, branch, shipment.docketDate);
        setNextNo(answer.no);
      } catch {
        setNextNo('');
      }
    };
    loadNextNo();
  }, [division, branch, shipment.docketDate, shipmentId]);

  const openShipment = async (id) => {
    try {
      const record = await shipmentApi.shipment(id);
      if (record.division !== division) {
        navigate('/freight/shipment/' + record.division.toLowerCase() + '?docket=' + encodeURIComponent(record.docketNo));
        return;
      }
      setShipment(shipmentFromRecord(record, division, myBranch));
      setShipmentId(record.id);
      setInvoices(record.invoices || []);
      setTab('shipment');
      setMessage({ text: 'Opened ' + record.docketNo + (record.stage && record.stage !== 'Register' ? ' - ' + record.stage : '') });
    } catch (error) {
      setMessage(errorNote(error));
    }
  };

  const docketParam = params.get('docket');
  useEffect(() => {
    if (!docketParam) return;
    const openFromLink = async () => {
      try {
        const found = await shipmentApi.byNo(docketParam);
        if (found) openShipment(found.id);
      } catch {
        // the screen keeps what it shows
      }
    };
    openFromLink();
  }, [docketParam]); // eslint-disable-line react-hooks/exhaustive-deps -- once per ?docket= link

  const getValue = (path) => readPath(shipment, path);
  const setValue = (path, value) => setShipment((current) => writePath(current, path, value));
  const updateShipment = (change) => setShipment((current) => ({ ...current, ...change(current) }));

  const clear = () => {
    setShipment(emptyShipment(division, myBranch));
    setShipmentId(null);
    setInvoices([]);
    setMessage(null);
    if (docketParam) setParams({});
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const body = { ...shipment, division, branchCode: branch };
      const saved = shipmentId ? await shipmentApi.update(shipmentId, body) : await shipmentApi.create(body);
      setShipmentId(saved.id);
      setShipment((current) => ({ ...current, docketNo: saved.docketNo }));
      const missing = saved.notInMaster?.length ? '. Not in the party master: ' + saved.notInMaster.join(', ') + ' - add them with + (needed for billing)' : '';
      setMessage({ tone: 'success', text: (shipmentId ? 'Modified ' : 'Saved - docket ') + saved.docketNo + missing });
    } catch (error) {
      setMessage(errorNote(error));
    }
    setBusy(false);
  };

  const remove = async () => {
    const reason = await askText({
      title: 'Delete docket ' + shipment.docketNo,
      message: `Delete docket ${shipment.docketNo}? Its status, activities, papers, uploaded files and provisional cost sheet go with it (a copy is kept).`,
      label: 'Reason',
      required: false,
      okLabel: 'Delete',
    });
    if (reason === null) return;
    setBusy(true);
    try {
      const answer = await shipmentApi.remove(shipmentId, reason);
      const docketNo = shipment.docketNo;
      clear();
      setMessage({ tone: 'success', text: 'Docket ' + docketNo + ' deleted' + (answer?.sheet ? ', with its provisional cost sheet' : '') + ' - a copy is kept' });
    } catch (error) {
      setMessage(errorNote(error));
    }
    setBusy(false);
  };

  const duplicate = async () => {
    try {
      const copy = await shipmentApi.duplicate(shipmentId);
      setShipment(shipmentFromRecord(copy, division, myBranch));
      setShipmentId(null);
      setMessage({ text: 'Copy made - change it and Save for a new docket' });
    } catch (error) {
      setMessage(errorNote(error));
    }
  };

  const syncCustoms = async () => {
    try {
      const answer = await shipmentApi.syncCustoms(shipmentId);
      const record = await shipmentApi.shipment(shipmentId);
      setShipment((current) => ({ ...current, currentStatus: record.currentStatus }));
      setMessage({ tone: 'success', text: answer.milestones + ' customs milestone(s) taken from job ' + shipment.ediJobNo });
    } catch (error) {
      setMessage(errorNote(error));
    }
  };

  // after a status / stage change on another tab, the header shows the docket's new stage and status
  const refreshStage = async () => {
    if (!shipmentId) return;
    try {
      const record = await shipmentApi.shipment(shipmentId);
      setShipment((current) => ({ ...current, stage: record.stage, currentStatus: record.currentStatus }));
    } catch {
      // the screen keeps what it shows
    }
  };

  return {
    division, meta, divisionInfo, isImport, isAir, labels, branch, tab, setTab, shipment, shipmentId, nextNo, message, setMessage, busy, invoices,
    getValue, setValue, updateShipment, setShipment, openShipment, clear, save, remove, duplicate, syncCustoms, refreshStage,
    goToDivision: (routeKey) => navigate('/freight/shipment/' + routeKey),
  };
}
