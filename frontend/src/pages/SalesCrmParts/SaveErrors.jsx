export default function SaveErrors({ errors }) {
  if (!errors.length) return null;
  return (
    <div role="alert" className="tw:w-full tw:rounded-md tw:border tw:border-destructive/30 tw:bg-destructive/5 tw:px-3.5 tw:py-3 tw:text-entry">
      <div className="tw:mb-1 tw:font-bold tw:text-destructive">Nothing was saved. Fix these first:</div>
      <ul className="tw:m-0 tw:pl-5 tw:text-destructive">
        {errors.map((problem, index) => <li key={index}>{problem}</li>)}
      </ul>
    </div>
  );
}
