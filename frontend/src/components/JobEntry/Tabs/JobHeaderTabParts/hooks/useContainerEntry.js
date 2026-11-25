import { useState } from 'react';
import toast from 'react-hot-toast';
import { useJobContext } from '../../../JobContext';

const EMPTY_CONTAINER = { srNo: '', igmNumber: '', igmDate: '', contNo: '', sealNo: '', lclFcl: '', contSize: '', contType: '', truckNo: '' };
const UPPERCASE_FIELDS = new Set(['contNo', 'sealNo', 'truckNo', 'contType']);

const containersOf = (job) => (Array.isArray(job.containers) ? job.containers : []);

export default function useContainerEntry() {
  const { jobData, setJobData } = useJobContext();
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [containerForm, setContainerForm] = useState(EMPTY_CONTAINER);

  const handleContainerChange = (event) => {
    const { name, value } = event.target;
    setContainerForm((previous) => ({ ...previous, [name]: UPPERCASE_FIELDS.has(name) ? value.toUpperCase() : value }));
  };

  const addContainer = () => {
    const containerNo = containerForm.contNo;
    if (!containerNo) { toast.error('Container No is required'); return; }
    const containers = containersOf(jobData);
    if (containers.some((container) => String(container.contNo || '').toUpperCase() === containerNo.toUpperCase())) { toast.error(`Container ${containerNo} is already added`); return; }
    const container = { ...containerForm, id: Date.now(), srNo: containerForm.srNo || String(containers.length + 1) };
    setJobData((previous) => ({ ...previous, containers: [...containersOf(previous), container] }));
    setContainerForm(EMPTY_CONTAINER);
  };

  const removeContainer = (id) => {
    setJobData((previous) => ({ ...previous, containers: containersOf(previous).filter((container) => container.id !== id) }));
  };

  const resetContainerForm = () => setContainerForm(EMPTY_CONTAINER);

  return { isContainerModalOpen, setIsContainerModalOpen, containerForm, handleContainerChange, addContainer, removeContainer, resetContainerForm };
}
