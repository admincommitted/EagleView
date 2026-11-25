import SharedRoutingSection from '../../shared/sections/RoutingSection';

export default function RoutingSection({ ctx }) {
  return <SharedRoutingSection ctx={ctx} flightTimeLabel="Dep Time" showCto upperCase declaredValuesRequiredWhenEmpty onDestAirportPick={ctx.handleDestAirportSelect} />;
}
