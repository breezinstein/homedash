import type { HostSnapshot } from '../../types';
import { SourceDot } from './SourceDot';
import { formatByteRate, formatBytesBinary } from '../format';

interface HostCardProps {
  host: HostSnapshot;
}

/**
 * Node card for the 3×3 server grid.  Compact layout with CPU/Memory/Disk
 * progress bars, load average, uptime, and network I/O in the footer.
 */
export function HostCard({ host }: HostCardProps) {
  const down = host.status === 'down';
  const h = host.host;
  const disk = host.disk ?? { total: null, used: null, percent: null };
  const cpu = host.cpu ?? { percent: null, cores: null, load: { '1m': null, '5m': null, '15m': null } };
  const memory = host.memory ?? { percent: null };
  const network = host.network ?? { rxBps: null, txBps: null };
  const load = cpu.load;
  const loadLabel =
    load['1m'] != null
      ? `${load['1m'].toFixed(1)} · ${load['5m']?.toFixed(1) ?? '—'} · ${load['15m']?.toFixed(1) ?? '—'}`
      : '—';
  const diskDetail = disk.total
    ? `${formatBytesBinary(disk.used)} / ${formatBytesBinary(disk.total)}`
    : undefined;
  const osLabel =
    host.system?.distro ||
    host.system?.platform ||
    '';
  const temp = host.temperature;
  let tempLabel = '—';
  let tempColor: string | undefined;
  if (temp?.value != null) {
    tempLabel = `${Math.round(temp.value)}°`;
    tempColor = temp.critical != null && temp.value >= temp.critical ? '#e74c3c'
      : temp.warning != null && temp.value >= temp.warning ? '#e67e22' : '#2ecc71';
  }

  return (
    <div className={`node-card ${down ? 'opacity-60' : ''}`}>
      {/* Title row */}
      <div className="node-title-row">
        <div>
          <span className="node-title">{h.name}</span>
          {osLabel && <span className="node-os">{osLabel}</span>}
        </div>
        <SourceDot status={host.status} />
      </div>

      {/* CPU — percentage + progress bar */}
      <div className="metric-row">
        <div className="metric-header">
          <span>CPU</span>
          <span
            className="metric-val"
            style={cpu.percent != null && cpu.percent >= 75 ? { color: '#e67e22' } : undefined}
          >
            {cpu.percent != null ? `${Math.round(cpu.percent)}%` : '—'}
          </span>
        </div>
        <div className="progress-bg">
          <div
            className={`progress-fill ${(cpu.percent ?? 0) >= 90 ? 'critical' : (cpu.percent ?? 0) >= 75 ? 'high' : ''}`}
            style={{ width: `${Math.min(100, Math.max(0, cpu.percent ?? 0))}%` }}
          />
        </div>
      </div>

      {/* Memory bar */}
      <div className="metric-row">
        <div className="metric-header">
          <span>Memory</span>
          <span className="metric-val">{memory.percent != null ? `${Math.round(memory.percent)}%` : '—'}</span>
        </div>
        <div className="progress-bg">
          <div
            className={`progress-fill ${(memory.percent ?? 0) >= 90 ? 'critical' : (memory.percent ?? 0) >= 75 ? 'high' : ''}`}
            style={{ width: `${Math.min(100, Math.max(0, memory.percent ?? 0))}%` }}
          />
        </div>
      </div>

      {/* Disk bar */}
      <div className="metric-row">
        <div className="metric-header">
          <span>Disk</span>
          <span
            className="metric-val"
            style={(disk.percent ?? 0) >= 90 ? { color: '#e74c3c' } : (disk.percent ?? 0) >= 75 ? { color: '#e67e22' } : undefined}
          >
            {disk.percent != null ? `${Math.round(disk.percent)}%` : '—'}
          </span>
        </div>
        <div className="progress-bg">
          <div
            className={`progress-fill ${(disk.percent ?? 0) >= 90 ? 'critical' : (disk.percent ?? 0) >= 75 ? 'high' : ''}`}
            style={{ width: `${Math.min(100, Math.max(0, disk.percent ?? 0))}%` }}
          />
        </div>
        {diskDetail && <div className="disk-detail">{diskDetail}</div>}
      </div>

      {host.error && (
        <div className="text-[#e74c3c] text-[11px] mt-1">⚠ {host.error}</div>
      )}

      {/* Footer: Load · Uptime · Network */}
      <div className="node-footer">
        <span>
          Load <b>{loadLabel}</b>
        </span>
        <span>
          Up <b>{host.uptime?.formatted || '—'}</b>
        </span>
        <span title={temp?.label ? `${temp.label} · max ${temp.max != null ? `${Math.round(temp.max)}°` : '—'}` : undefined}>
          Temp <b style={tempColor ? { color: tempColor } : undefined}>{tempLabel}</b>
        </span>
        <span>
          ↓ {formatByteRate(network.rxBps ?? null)} ↑ {formatByteRate(network.txBps ?? null)}
        </span>
      </div>
    </div>
  );
}
