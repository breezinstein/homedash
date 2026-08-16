import { Container } from 'lucide-react';
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
          <span className="card-icon card-icon-purple">
            <Container className="w-4 h-4" />
          </span>
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
              <RingGauge percent={runPct} size={70} color="var(--mon-accent)" />
              <div className="gauge-val">{docker.running}/{total}</div>
            </div>
          </div>

          {/* Counts + problems */}
          <div className="summary-list">
            <div className="docker-counts">
              <DockerCount color="var(--mon-ok)" label="Running" value={docker.running} />
              <DockerCount color="var(--mon-accent)" label="Healthy" value={docker.healthy} />
              <DockerCount color="var(--mon-danger)" label="Unhealthy" value={docker.unhealthy} />
              <DockerCount color="var(--mon-warn)" label="Restarting" value={docker.restarting} />
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
        <div className="text-[var(--mon-text-muted)] text-[12px]">No container data available</div>
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
