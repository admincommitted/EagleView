import SharedPartyRow from '../shared/PartyRow';

export default function PartyRow(props) {
  return <SharedPartyRow {...props} keepMasterFields={false} />;
}
