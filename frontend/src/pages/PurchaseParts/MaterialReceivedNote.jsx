import { useNavigate } from 'react-router-dom';
import { PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui';
import Notice from './Notice';

/** Shown under an approved PO: the received material is put in stock from Asset Management. */
export default function MaterialReceivedNote() {
  const navigate = useNavigate();
  return (
    <Notice tone="success" title="Material Received? Add to Assets">
      <div>
        <Button variant="success" onClick={() => navigate('/asset-management')}><PackagePlus /> Go to Asset Management</Button>
      </div>
    </Notice>
  );
}
