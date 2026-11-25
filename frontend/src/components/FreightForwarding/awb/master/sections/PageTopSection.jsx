import SharedPageTopSection from '../../shared/sections/PageTopSection';

export default function PageTopSection({ ctx }) {
  return <SharedPageTopSection ctx={ctx} awbKind="MAWB" extraPrintData={{ airlineName: ctx.airlineName, linkedHawbs: ctx.linkedHawbs }} />;
}
