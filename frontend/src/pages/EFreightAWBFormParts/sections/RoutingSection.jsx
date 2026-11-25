import { Fragment } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import { AwbCard } from '../awbParts';

const RoutingBox = ({ label, filled }) => (
  <Field layout="col" label={label} className="tw:w-full tw:sm:w-auto">
    <Input data-allow-text className={filled ? 'tw:bg-muted' : undefined} />
  </Field>
);

export default function RoutingSection({ ctx }) {
  const { routingStops, setRoutingStops } = ctx;
  return (
    <AwbCard icon={MapPin} title="Routing Details">
      <div className="tw:flex tw:flex-wrap tw:items-end tw:gap-4">
        {routingStops.map((stop, index) => (
          <Fragment key={index}>
            <RoutingBox label="Carrier" />
            <RoutingBox label="Destination" filled />
          </Fragment>
        ))}
        <RoutingBox label="Origin" filled />
        <RoutingBox label="Carrier" />
        <Button variant="default" size="icon" aria-label="Add a routing stop" className="tw:rounded-full" onClick={() => setRoutingStops([...routingStops, {}])}>
          <Plus className="tw:size-4" />
        </Button>
        <RoutingBox label="Destination" filled />
      </div>
    </AwbCard>
  );
}
