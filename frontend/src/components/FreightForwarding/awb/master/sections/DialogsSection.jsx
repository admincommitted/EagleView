import SharedDialogsSection from '../../shared/sections/DialogsSection';

const flightStart = (date, time) => (date ? `${date}T${time || '00:00:00'}` : '');

export default function DialogsSection({ ctx }) {
  const { destAirport, executedDate, flightDate1, flightNumber1, flightTime1 } = ctx;
  const consol = {
    consigneeName: '',
    destination: destAirport || '',
    flightNumber1: flightNumber1 || '',
    flightDate1: flightStart(flightDate1, flightTime1),
    status: 'ACTIVE',
    executedDate: executedDate || '',
  };
  return <SharedDialogsSection ctx={ctx} awbType="MAWB" manifestMawbData={consol} linkHawbs />;
}
