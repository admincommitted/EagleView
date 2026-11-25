import { Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SpinningLoader({ className }) {
  return <Loader className={cn(className, 'tw:animate-spin')} />;
}
