import type { ComponentType, ReactNode } from 'react';
import { Meter, MeterIndicator, MeterLabel, MeterTrack, MeterValue } from '@ui-sdk/react/meter';
import { usageLevel, type Level } from '../../lib/levels';

type Icon = ComponentType<{ className?: string }>;

interface StatTileProps {
  label: ReactNode;
  icon?: Icon;
  /** State chip on the right of the head, like “Charging” or “2 unhealthy”. */
  chip?: ReactNode;
  value?: ReactNode;
  unit?: ReactNode;
  detail?: ReactNode;
  /** Colours the headline number by level. */
  level?: Level;
  /** Ring, meter or extra rows under the headline. */
  children?: ReactNode;
  /** Ring beside the headline instead of under it. */
  aside?: ReactNode;
  className?: string;
}

/** One headline number with a label, a state chip and a line of detail. */
export function StatTile({ label, icon: Icon, chip, value, unit, detail, level, children, aside, className }: StatTileProps) {
  const headline = value !== undefined && (
    <div className="ui-tile-value" data-level={level}>
      {value}
      {unit ? <span className="ui-tile-unit">{unit}</span> : null}
    </div>
  );
  return (
    <section className={className ? `ui-tile ${className}` : 'ui-tile'}>
      <div className="ui-tile-head">
        {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
        <span className="min-w-0 truncate">{label}</span>
        {chip ? <span className="ml-auto flex shrink-0 items-center gap-1">{chip}</span> : null}
      </div>
      {aside ? (
        <div className="ui-tile-row">
          {aside}
          <div className="min-w-0">
            {headline}
            {detail ? <p className="ui-tile-detail">{detail}</p> : null}
          </div>
        </div>
      ) : (
        <>
          {headline}
          {children}
          {detail ? <p className="ui-tile-detail">{detail}</p> : null}
        </>
      )}
      {aside ? children : null}
    </section>
  );
}

interface LevelMeterProps {
  label: string;
  /** 0–100 unless min/max say otherwise; null shows an empty track and a dash. */
  value: number | null | undefined;
  min?: number;
  max?: number;
  /** Text beside the label, like “19.5 / 32 GB”. */
  detail?: ReactNode;
  /** Visible value; defaults to the rounded percentage. */
  valueText?: string;
  /** Spoken value when the visible text needs context. */
  valueLabel?: string;
  level?: Level;
  className?: string;
}

/** A bar meter coloured by level (75% warn, 90% critical unless `level` is given). */
export function LevelMeter({ label, value, min = 0, max = 100, detail, valueText, valueLabel, level, className }: LevelMeterProps) {
  const has = value != null && Number.isFinite(value);
  const pct = has ? ((value - min) / Math.max(1e-9, max - min)) * 100 : 0;
  const resolved = level ?? (has ? usageLevel(pct) : undefined);
  const text = valueText ?? (has ? `${Math.round(pct)}%` : '—');
  return (
    <Meter
      value={has ? value : min}
      min={min}
      max={max}
      className={className ? `ui-meter ${className}` : 'ui-meter'}
      data-level={resolved}
      data-empty={has ? undefined : ''}
      getValueLabel={() => valueLabel ?? (has ? text : 'No reading')}
    >
      <div className="ui-meter-head">
        <MeterLabel className="ui-meter-label">
          {label}
          {detail ? <span className="ui-meter-detail">{detail}</span> : null}
        </MeterLabel>
        <MeterValue className="ui-meter-value">{text}</MeterValue>
      </div>
      <MeterTrack className="ui-meter-track">
        <MeterIndicator className="ui-meter-fill" />
      </MeterTrack>
    </Meter>
  );
}

interface RingMeterProps {
  label: string;
  value: number | null | undefined;
  min?: number;
  max?: number;
  valueText?: string;
  /** `info` draws the accent colour for ratios that are neither good nor bad, like link load. */
  level?: Level | 'info';
  size?: 'md' | 'lg';
}

/** A ring for one headline ratio, like battery charge or healthy containers. */
export function RingMeter({ label, value, min = 0, max = 100, valueText, level, size = 'md' }: RingMeterProps) {
  const has = value != null && Number.isFinite(value);
  const pct = has ? Math.min(100, Math.max(0, ((value - min) / Math.max(1e-9, max - min)) * 100)) : 0;
  const text = valueText ?? (has ? `${Math.round(pct)}%` : '—');
  return (
    <Meter
      value={has ? value : min}
      min={min}
      max={max}
      aria-label={label}
      className="ui-ring"
      data-size={size}
      data-level={level ?? (has ? 'ok' : undefined)}
      getValueLabel={() => (has ? text : 'No reading')}
    >
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="ui-ring-track" cx="18" cy="18" r="15.915" />
        {pct > 0.5 ? <circle className="ui-ring-fill" cx="18" cy="18" r="15.915" strokeDasharray={`${pct} 100`} /> : null}
      </svg>
      <MeterValue className="ui-ring-value">{text}</MeterValue>
    </Meter>
  );
}
