import SharedPartiesSection from '../../shared/sections/PartiesSection';

export default function PartiesSection({ ctx }) {
  return <SharedPartiesSection ctx={ctx} onAwbSuffixBlur={ctx.handleMawbFetch} />;
}
