/**
 * HomeStatusCard — Home Assistant / smart-home snapshot.
 *
 * This card displays a summary of the household: pump status, lights,
 * active media players, fans, and open doors.  Currently driven by
 * static mock data until a Home Assistant integration ships on the
 * server side.
 */

import { SourceDot } from './SourceDot';
import { SummaryRow } from './SummaryRow';

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
        <div className="card-title-row">
          <span className="card-icon card-icon-blue">🏠</span>
          <div className="title-group">
            <span className="title">Home Status</span>
            <span className="subtitle">Overview</span>
          </div>
        </div>
        <SourceDot status="ok" />
      </div>

      <div className="summary-body">
        {/* Pump indicator */}
        <div className="summary-gauge">
          <div className="pump-box">
            <div className="pump-dot">
              ● PUMP {d.pumpRunning ? 'RUNNING' : 'OFF'}
            </div>
            <div className="infinity-symbol">∞</div>
            <div className="pump-duration">⏱ {d.pumpDuration}</div>
            <div className="pump-label">{d.pumpLabel}</div>
          </div>
        </div>

        {/* Metrics */}
        <div className="summary-list">
          <SummaryRow icon="💡" label="Lights on" value={`${d.lightsOn} lights`} />
          <SummaryRow icon="📺" label="Media players" value={`${d.mediaActive} active`} />
          <SummaryRow icon="🌀" label="Fans" value={`${d.fansRunning} running`} />
          <SummaryRow
            icon="🚪"
            label="Doors open"
            value={`${d.doorsOpen} open`}
            accent={d.doorsOpen > 0 ? '#e74c3c' : undefined}
          />
        </div>
      </div>
    </section>
  );
}
