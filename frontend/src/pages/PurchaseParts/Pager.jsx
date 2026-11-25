import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button, SelectBox } from '@/components/ui';
import { PAGE_SIZES } from './purchaseFormat';

const GAP = '...';

/** Page numbers: the first, the last, and two on each side of the current page. */
function pageNumbers(page, totalPages) {
  const numbers = [];
  for (let number = 1; number <= totalPages; number += 1) {
    if (number === 1 || number === totalPages || Math.abs(number - page) <= 2) numbers.push(number);
    else if (numbers[numbers.length - 1] !== GAP) numbers.push(GAP);
  }
  return numbers;
}

export default function Pager({ page, totalPages, pageSize, total, onPage, onPageSize }) {
  const first = (page - 1) * pageSize;
  const goTo = (number) => onPage(Math.min(Math.max(1, number), totalPages));
  const step = (icon, label, target, disabled) => {
    const Icon = icon;
    return <Button size="icon-sm" title={label} aria-label={label} disabled={disabled} onClick={() => goTo(target)}><Icon /></Button>;
  };

  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:text-[11px] tw:text-muted-foreground">
      <div className="tw:flex tw:items-center tw:gap-2">
        <span>{first + 1}-{Math.min(first + pageSize, total)} of {total}</span>
        <SelectBox size="sm" className="tw:w-28" value={pageSize} onValueChange={(size) => onPageSize(Number(size))}
          options={PAGE_SIZES.map((size) => ({ value: size, label: `${size} / page` }))} />
      </div>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1">
        {step(ChevronsLeft, 'First page', 1, page === 1)}
        {step(ChevronLeft, 'Previous page', page - 1, page === 1)}
        {pageNumbers(page, totalPages).map((number, index) => (number === GAP
          ? <span key={`gap-${index}`} className="tw:px-0.5 tw:font-bold">{GAP}</span>
          : (
            <Button key={number} size="sm" variant={number === page ? 'default' : 'outline'} className="tw:min-w-[22px]"
              aria-current={number === page ? 'page' : undefined} onClick={() => goTo(number)}>{number}</Button>
          )))}
        {step(ChevronRight, 'Next page', page + 1, page === totalPages)}
        {step(ChevronsRight, 'Last page', totalPages, page === totalPages)}
      </div>
    </div>
  );
}
