/**
 * HomeStatusCard — Home Assistant / smart-home snapshot.
 *
 * This card displays a summary of the household: pump status, lights,
 * active media players, fans, and open doors.  Currently driven by
 * static mock data until a Home Assistant integration ships on the
 * server side.
 */

import { SourceDot } from './SourceDot';

export interface HomeStatusData {
  pumpRunning: boolean;
  pumpLabel: string;
  pumpDuration: string; // e.g. "Running indefinitely" or "15m remaining"
  lightsOn: number;
  mediaActive: number;
  fansRunning: number;
  doorsOpen: number;
}

const MOCK_HOME: HomeStatusData = {
  pumpRunning: true,
  pumpLabel: 'PRESSURE PUMP',
  pumpDuration: 'Running indefinitely',
  lightsOn: 9,
  mediaActive: 3,
  fansRunning: 2,
  doorsOpen: 1,
};

interface HomeStatusCardProps {
  data?: HomeStatusData;
}

export function HomeStatusCard({ data }: HomeStatusCardProps) {
  const d = data ?? MOCK_HOME;

  return (
    <section className="card">
      <div className="card-header">
        <div className="title-group">
          <span className="title">Home Status</span>
          <span className="subtitle">Overview</span>
        </div>
        <SourceDot status="ok" />
      </div>

      <div className="power-body">
        {/* Pump indicator */}
        <div className="pump-box">
          <div className="pump-dot">
            ● PUMP {d.pumpRunning ? 'RUNNING' : 'OFF'}
          </div>
          <div className="infinity-symbol">∞</div>
          <div className="pump-duration">⏱ {d.pumpDuration}</div>
          <div className="pump-label">{d.pumpLabel}</div>
        </div>

        {/* Metrics */}
        <div className="data-list" style={{ marginLeft: 10 }}>
          <div className="data-row">
            <span className="row-label">Lights on</span>
            <span className="row-value">{d.lightsOn} lights</span>
          </div>
          <div className="data-row">
            <span className="row-label">Media players</span>
            <span className="row-value">{d.mediaActive} active</span>
          </div>
          <div className="data-row">
            <span className="row-label">Fans</span>
            <span className="row-value">{d.fansRunning} running</span>
          </div>
          <div className="data-row">
            <span className="row-label">Doors open</span>
            <span
              className="row-value"
              style={d.doorsOpen > 0 ? { color: '#e74c3c' } : undefined}
            >
              {d.doorsOpen} open
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
