import { Loader } from 'lucide-react';

export default function AiExtractOverlay() {
  return (
    <div className="tw:fixed tw:inset-0 tw:z-[9999] tw:flex tw:items-center tw:justify-center tw:bg-foreground/60 tw:backdrop-blur-sm">
      <div className="tw:flex tw:w-[340px] tw:max-w-[calc(100%-2rem)] tw:flex-col tw:items-center tw:rounded-xl tw:border-t-4 tw:border-primary tw:bg-card tw:px-8 tw:py-6 tw:shadow-xl tw:normal-case">
        <div className="tw:mb-4 tw:flex tw:size-12 tw:items-center tw:justify-center tw:rounded-full tw:bg-primary/10">
          <Loader className="tw:size-6 tw:animate-spin tw:text-primary" />
        </div>
        <p className="tw:m-0 tw:mb-2 tw:text-center tw:text-base tw:font-semibold tw:text-foreground">Extracting AI Data...</p>
        <p className="tw:m-0 tw:text-center tw:text-[13px] tw:leading-snug tw:text-muted-foreground">
          Reading your PDF documents.<br />Please wait 15-45 seconds.
        </p>
      </div>
    </div>
  );
}
