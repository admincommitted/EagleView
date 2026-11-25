import { useState } from 'react';
import { useJobContext } from '../../../JobContext';

// Bill of Entry Y/N flags: the value shown -> the jobData key it is saved under
const FLAG_JOB_KEYS = {
  highSeaSale: 'highSeaSaleFlag',
  section48: 'section48Requested',
  firstCheck: 'firstCheckRequested',
  priorBE: 'whetherPriorBE',
  provAssess: 'provAssess',
  addtlDetails: 'addtlDetails',
};

export default function useYesNoFlags() {
  const { jobData } = useJobContext();
  const [isSection48ModalOpen, setIsSection48ModalOpen] = useState(false);
  const [isFirstCheckModalOpen, setIsFirstCheckModalOpen] = useState(false);
  const [isProvAssessModalOpen, setIsProvAssessModalOpen] = useState(false);

  const flags = Object.fromEntries(Object.entries(FLAG_JOB_KEYS).map(([flag, jobKey]) => [flag, jobData[jobKey] || 'N']));

  return {
    ...flags,
    isSection48ModalOpen, setIsSection48ModalOpen,
    isFirstCheckModalOpen, setIsFirstCheckModalOpen,
    isProvAssessModalOpen, setIsProvAssessModalOpen,
  };
}
