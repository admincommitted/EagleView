import { ActionMenu } from '@/components/ui';

const toneOf = (item) => {
  if (item.danger) return 'danger';
  return item.iconColor ? 'accent' : undefined;
};

const toActionItem = (item, onClose) => {
  if (item.sep) return { separator: true };
  if (item.head) return { heading: item.head };
  return {
    label: item.label,
    icon: item.icon,
    note: item.note,
    title: item.title || undefined,
    disabled: Boolean(item.disabled),
    tone: toneOf(item),
    onSelect: () => {
      onClose();
      item.onClick?.();
    },
  };
};

// Right-click menu of a job row.
// menu = { x, y, items: [ { head } | { sep: true } | { label, icon, onClick, disabled, title, danger, iconColor, note } ] }
export default function RowContextMenu({ menu, onClose }) {
  if (!menu) return null;
  return (
    <ActionMenu
      key={`${menu.x}-${menu.y}`}
      open
      onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}
      position={{ x: menu.x, y: menu.y }}
      items={menu.items.filter(Boolean).map((item) => toActionItem(item, onClose))}
      className="tw:min-w-[250px] tw:max-w-[340px]"
    />
  );
}
