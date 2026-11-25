import { ImageUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, FileButton } from '@/components/ui';

const MAX_LOGO_BYTES = 500 * 1024;

// picks an image (max 500 KB) and hands it over as a data URL
export function LogoUploadButton({ onLogo, children }) {
  const readLogo = ([file]) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('ERROR: Image size must be less than 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => onLogo(reader.result);
    reader.readAsDataURL(file);
  };
  return <FileButton accept="image/*" onFiles={readLogo} className="tw:w-full"><ImageUp /> {children}</FileButton>;
}

// the small edit / delete icon of a grid row; the click does not reach the row
export function RowIconButton({ icon: Icon, title, onClick, danger }) {
  return (
    <Button variant="ghost" size="icon-sm" title={title} className={danger ? 'tw:text-destructive' : 'tw:text-primary'}
      onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <Icon />
    </Button>
  );
}
