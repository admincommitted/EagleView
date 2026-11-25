import SharedActionBarSection from '../../shared/sections/ActionBarSection';

export default function ActionBarSection({ ctx }) {
  return <SharedActionBarSection ctx={ctx} awbType="MAWB" sendXfwb consolTools bottomRule={false} />;
}
