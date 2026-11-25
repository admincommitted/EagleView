import { useJobContext } from './JobContext';

// Unit suggestions (datalist id uqc-list) still read by the item UQC box. Remove this component once that box uses
// ComboInput.
export default function JobMasterLists() {
  const { masters } = useJobContext();
  return (
    <datalist id="uqc-list">{masters.uqcs?.map((uqc) => <option key={uqc.id} value={uqc.uqcCode}>{uqc.description}</option>)}</datalist>
  );
}
