import type { DockerSummary } from '../../types';
import { SourceDot } from './SourceDot';
import { RingGauge } from './RingGauge';

interface DockerCardProps {
  docker: DockerSummary;
}

export function DockerCard({ docker }: DockerCardProps) {
  const total = docker.total || 0;
  const hasIssues = docker.unhealthy > 0 || docker.restarting > 0;
  const runPct = total > 0 ? Math.round((docker.running / total) * 100) : 0;

  return (
    <section className="card">
      <div className="card-header">
        <div className="title-group">
          <span className="title">Docker</span>
          <span className="subtitle">
            {total > 0 ? `${docker.running}/${total} running` : 'no containers'}
          </span>
        </div>
        {hasIssues ? (
          <span className="status-warn">{docker.unhealthy + docker.restarting} issues</span>
        ) : (
          <SourceDot status={docker.status} />
        )}
      </div>

      {total > 0 && (
        <div className="docker-body">
          {/* Gauge */}
          <div className="gauge-box">
            <RingGauge percent={runPct} size={70} />
            <div className="gauge-val">{docker.running}/{total}</div>
          </div>

          {/* Stats + problems */}
          <div>
            <div className="docker-stats">
              <StatItem color="#2ecc71" label="Running" value={docker.running} />
              <StatItem color="#6c5ce7" label="Healthy" value={docker.healthy} />
              <StatItem color="#e74c3c" label="Unhealthy" value={docker.unhealthy} />
              <StatItem color="#f1c40f" label="Restarting" value={docker.restarting} />
            </div>

            {docker.problems.length > 0 && (
              <>
                <div className="docker-divider" />
                <div className="data-list" style={{ fontSize: 11 }}>
                  {docker.problems.map((p, i) => (
                    <div className="data-row" key={i}>
                      <span>{p.name}</span>
                      <span className="badge-unhealthy">
                        {p.health === 'unhealthy' ? 'UNHEALTHY' : p.state.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="text-[#a0a0a0] text-[12px]">No container data available</div>
      )}
    </section>
  );
}

function StatItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="stat-item">
      <span style={{ color }}>● {label}</span>
      <b>{value}</b>
    </div>
  );
}
