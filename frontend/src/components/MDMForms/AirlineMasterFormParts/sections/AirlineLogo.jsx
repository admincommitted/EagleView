import { cn } from '@/lib/utils';

// the uploaded logo, else the public logo of the 2-letter code; hidden when neither loads
export default function AirlineLogo({ airline, alt, className }) {
  return (
    <img src={airline.customLogo || `https://pics.avs.io/200/200/${airline.code2}.png`} alt={alt || airline.code2}
      className={cn('tw:object-contain', className)}
      onLoad={(event) => { event.currentTarget.hidden = false; }} onError={(event) => { event.currentTarget.hidden = true; }} />
  );
}
