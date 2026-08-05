import type { SourceStatus } from '../../types';

interface SourceDotProps {
  status: SourceStatus;
}

const palette: Record<SourceStatus, { color: string; label: string }> = {
  ok: { color: '#2ecc71', label: 'ok' },
  degraded: { color: '#e67e22', label: 'degraded' },
  down: { color: '#e74c3c', label: 'down' },
};

export function SourceDot({ status }: SourceDotProps) {
  const { color } = palette[status];
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        color,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          backgroundColor: color,
          borderRadius: '50%',
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      {status}
    </span>
  );
}
