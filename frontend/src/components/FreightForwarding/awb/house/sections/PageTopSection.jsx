import SharedPageTopSection from '../../shared/sections/PageTopSection';

export default function PageTopSection({ ctx }) {
  return <SharedPageTopSection ctx={ctx} awbKind="HAWB" extraPrintData={{ hawbNumber: ctx.hawbNumber }} />;
}
