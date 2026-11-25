import SharedPartiesSection from '../../shared/sections/PartiesSection';

export default function PartiesSection({ ctx }) {
  return <SharedPartiesSection ctx={ctx} awbNoLabel="MAWB NO" hawbBox="link" fillAgentOci keepPartyMasterFields={false} />;
}
