import { Paperclip, X } from 'lucide-react';
import { Button, FileButton } from '@/components/ui';

/** Pick one file: a button, the picked file's name and a clear button. */
export default function FilePicker({ accept, file, onFile, buttonLabel = 'Choose file', emptyText = 'No file chosen' }) {
  return (
    <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
      <FileButton accept={accept} onFiles={(files) => onFile(files[0] || null)}><Paperclip /> {buttonLabel}</FileButton>
      <span className="tw:min-w-0 tw:truncate tw:text-[11px] tw:normal-case tw:text-muted-foreground">{file ? file.name : emptyText}</span>
      {file && (
        <Button variant="ghost" size="icon-sm" title="Remove the file" aria-label="Remove the file" onClick={() => onFile(null)}><X /></Button>
      )}
    </div>
  );
}
