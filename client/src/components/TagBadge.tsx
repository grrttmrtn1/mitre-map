import type { Tag } from '../types';

interface Props {
  tag: Tag;
  onRemove?: () => void;
  small?: boolean;
}

export default function TagBadge({ tag, onRemove, small }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${small ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5 text-xs'}`}
      style={{ borderColor: tag.color + '60', backgroundColor: tag.color + '20', color: tag.color }}
    >
      {tag.name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 leading-none ml-0.5" title="Remove tag">×</button>
      )}
    </span>
  );
}
