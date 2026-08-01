import type { DockerSummary } from '../../types';
import { SourceDot } from './SourceDot';

interface DockerCardProps {
  docker: DockerSummary;
}

export function DockerCard({ docker }: DockerCardProps) {
  const total = docker.total || 0;
  const runPct = total > 0 ? (docker.running / total) * 100 : 0;
  const unhPct = total > 0 ? (docker.unhealthy / total) * 100 : 0;
  const rstPct = total > 0 ? (docker.restarting / total) * 100 : 0;

  return (
    <section className="flex flex-col rounded-2xl border border-[var(--color-border)] p-[14px_16px] bg-[var(--color-surface)] min-h-0 flex-1">
      <div className="flex items-center gap-[9px] mb-[11px]">
        <h2 className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">🐳 Docker</h2>
        <span className="text-[11px] text-[var(--color-text-secondary)]">{total > 0 ? `${docker.running}/${total} running` : 'no containers'}</span>
        <div className="ml-auto"><SourceDot status={docker.status} /></div>
      </div>

      {total > 0 && (
        <>
          <div className="flex items-center gap-4 mb-3">
            {/* Donut */}
            <div
              className="w-[78px] h-[78px] rounded-full flex-shrink-0 relative grid place-items-center"
              style={{
                background: `conic-gradient(
                  var(--color-success) 0 ${runPct - unhPct - rstPct}%,
                  var(--color-error) 0 ${runPct - rstPct}%,
                  var(--color-warning) 0 ${runPct}%,
                  var(--color-surface) 0)`,
              }}
            >
              <div className="absolute w-[56px] h-[56px] rounded-full bg-[var(--color-surface)]" />
              <span className="relative font-[750] text-[15px] tabular-nums text-[var(--color-text-primary)]">{docker.running}/{total}</span>
            </div>

            <div className="grid grid-cols-2 gap-y-1 gap-x-[14px] text-[12px]">
              <Count label="Running" color="var(--color-success)" value={docker.running} />
              <Count label="Healthy" color="var(--color-primary)" value={docker.healthy} />
              <Count label="Unhealthy" color="var(--color-error)" value={docker.unhealthy} />
              <Count label="Restarting" color="var(--color-warning)" value={docker.restarting} />
            </div>
          </div>

          {docker.problems.length > 0 ? (
            <div className="border-t border-[var(--color-border)] pt-2 text-[12px] overflow-auto">
              {docker.problems.map((p, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className="font-semibold">{p.name}</span>
                  <span className={`ml-auto text-[11px] font-bold uppercase tracking-[.4px] ${p.health === 'unhealthy' || p.state === 'dead' ? 'text-[var(--color-error)]' : 'text-[var(--color-warning)]'}`}>
                    {p.health === 'unhealthy' ? 'unhealthy' : p.state}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[var(--color-text-secondary)] text-[12px] flex gap-[7px] items-center">✓ All containers healthy</div>
          )}
        </>
      )}

      {total === 0 && (
        <div className="text-[var(--color-text-secondary)] text-[12px]">No container data available</div>
      )}
    </section>
  );
}

function Count({ label, color, value }: { label: string; color: string; value: number }) {
  return (
    <div className="flex items-center gap-[7px] text-[var(--color-text-secondary)]">
      <span className="w-[9px] h-[9px] rounded-[3px] flex-shrink-0" style={{ backgroundColor: color }} />
      {label} <b className="text-[var(--color-text-primary)]">{value}</b>
    </div>
  );
}
