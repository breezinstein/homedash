import type { SourceStatus } from '../../types';

interface SourceDotProps {
  status: SourceStatus;
}

const colors: Record<SourceStatus, string> = {
  ok: 'text-[var(--color-success)]',
  degraded: 'text-[var(--color-warning)]',
  down: 'text-[var(--color-error)]',
};

export function SourceDot({ status }: SourceDotProps) {
  return (
    <span className={`flex items-center gap-[6px] text-[11px] font-semibold ${colors[status]}`}>
      <span
        className="w-[9px] h-[9px] rounded-full"
        style={{ backgroundColor: 'currentColor', boxShadow: '0 0 8px currentColor' }}
      />
      {status}
    </span>
  );
}
