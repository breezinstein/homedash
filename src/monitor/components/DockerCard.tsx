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
        <div className="card-title-row">
          <span className="card-icon card-icon-purple">🐳</span>
          <div className="title-group">
            <span className="title">Docker</span>
            <span className="subtitle">
              {total > 0 ? `${docker.running}/${total} running` : 'no containers'}
            </span>
          </div>
        </div>
        {hasIssues ? (
          <span className="status-warn">{docker.unhealthy + docker.restarting} issues</span>
        ) : (
          <SourceDot status={docker.status} />
        )}
      </div>

      {total > 0 && (
        <div className="summary-body">
          {/* Gauge */}
          <div className="summary-gauge">
            <div className="gauge-box" style={{ margin: '0 auto' }}>
              <RingGauge percent={runPct} size={70} color="#6c5ce7" />
              <div className="gauge-val">{docker.running}/{total}</div>
            </div>
          </div>

          {/* Counts + problems */}
          <div className="summary-list">
            <div className="docker-counts">
              <DockerCount color="#2ecc71" label="Running" value={docker.running} />
              <DockerCount color="#6c5ce7" label="Healthy" value={docker.healthy} />
              <DockerCount color="#e74c3c" label="Unhealthy" value={docker.unhealthy} />
              <DockerCount color="#f1c40f" label="Restarting" value={docker.restarting} />
            </div>

            {docker.problems.length > 0 && (
              <>
                <div className="docker-divider" />
                <div className="docker-problems">
                  {docker.problems.map((p, i) => (
                    <span key={i} className="docker-problem" title={p.name}>
                      <span className="docker-problem-tag">
                        {p.health === 'unhealthy' ? 'UNHEALTHY' : p.state.toUpperCase()}
                      </span>
                      <span className="docker-problem-name">{p.name}</span>
                    </span>
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

function DockerCount({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="docker-count">
      <span className="docker-count-swatch" style={{ background: color }} />
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
