import SharedDialogsSection from '../../shared/sections/DialogsSection';

export default function DialogsSection({ ctx }) {
  return <SharedDialogsSection ctx={ctx} awbType="HAWB" vaultAwbNumber={ctx.hawbNumber ? `HAWB ${ctx.hawbNumber}` : ''} />;
}
