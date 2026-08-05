import type { SourceStatus } from '../../types';
import { STATUS_COLORS } from '../constants';

interface SourceDotProps {
  status: SourceStatus;
}

export function SourceDot({ status }: SourceDotProps) {
  const color = STATUS_COLORS[status];
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
