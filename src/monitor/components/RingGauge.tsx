import type { CSSProperties } from 'react';

interface RingGaugeProps {
  /** 0-100 value; null means indeterminate */
  percent: number | null;
  /** diameter in px (default 70) */
  size?: number;
  /** stroke width in px (default 4) */
  strokeWidth?: number;
  /** stroke colour; falls back to success colour */
  color?: string;
  /** colour when value meets/exceeds this threshold */
  warnAt?: number;
  warnColor?: string;
  /** colour when value meets/exceeds this threshold */
  criticalAt?: number;
  criticalColor?: string;
  className?: string;
}

const bgColor = '#2b2b36';
const defaultColor = '#34d399';
const defaultWarn = '#f59e0b';
const defaultCritical = '#ef4444';

/**
 * Minimal SVG ring gauge. Renders a background track and a foreground arc
 * whose dashoffset drives the fill.  The caller overlays the value label
 * via absolute positioning (centre slot left empty).
 */
export function RingGauge({
  percent,
  size = 70,
  strokeWidth = 4,
  color,
  warnAt = 75,
  warnColor = defaultWarn,
  criticalAt = 90,
  criticalColor = defaultCritical,
}: RingGaugeProps) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = percent != null ? Math.min(100, Math.max(0, percent)) : 0;

  const strokeColor =
    color ??
    (pct >= criticalAt ? criticalColor : pct >= warnAt ? warnColor : defaultColor);

  const dash = (pct / 100) * circumference;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', width: size, height: size } as CSSProperties}
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={bgColor}
        strokeWidth={strokeWidth}
      />
      {/* Foreground arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference - dash}`}
      />
    </svg>
  );
}
