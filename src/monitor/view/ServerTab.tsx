import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import type { HostSnapshot } from '../../types';
import { LevelMeter, Sparkline, useSeries } from '../../components/ui';
import { temperatureLevel, usageLevel, worstLevel, type Level } from '../../lib/levels';
import { formatByteRate, formatBytesBinary, formatDuration } from '../format';
import { Dot, Empty, LevelChip } from './parts';

type Sort = 'attention' | 'name';
const SORT_KEY = 'homedash-monitor-host-sort';
const MAX_VISIBLE = 9;

function readSort(): Sort {
  try {
    return localStorage.getItem(SORT_KEY) === 'name' ? 'name' : 'attention';
  } catch {
    return 'attention';
  }
}

function hostLevel(h: HostSnapshot): Level | undefined {
  if (h.status === 'down') return 'critical';
  const t = h.temperature;
  return worstLevel(
    usageLevel(h.cpu?.percent),
    usageLevel(h.memory?.percent, 85, 95),
    usageLevel(h.disk?.percent),
    temperatureLevel(t?.value, t?.warning ?? 70, t?.critical ?? 85),
    h.status === 'degraded' ? 'warn' : undefined,
  );
}

function attentionScore(h: HostSnapshot): number {
  const lvl = hostLevel(h);
  const base = h.status === 'down' ? 3000 : lvl === 'critical' ? 2000 : lvl === 'warn' ? 1000 : 0;
  return base + Math.max(h.cpu?.percent ?? 0, h.memory?.percent ?? 0, h.disk?.percent ?? 0);
}

/** Host cards in a 3×3 grid with a summary line, ordered by what needs a look first. */
export function ServerTab({ hosts }: { hosts: HostSnapshot[] }) {
  const [sort, setSort] = useState<Sort>(readSort);

  const ordered = useMemo(() => {
    const list = [...hosts];
    if (sort === 'name') list.sort((a, b) => a.host.name.localeCompare(b.host.name));
    else list.sort((a, b) => attentionScore(b) - attentionScore(a) || a.host.name.localeCompare(b.host.name));
    return list;
  }, [hosts, sort]);

  if (hosts.length === 0) {
    return <Empty>No servers are switched on for the monitor. Turn some on in Settings → Servers.</Empty>;
  }

  const up = hosts.filter((h) => h.status !== 'down');
  const busiest = maxBy(up, (h) => h.cpu?.percent ?? -1);
  const hottest = maxBy(up, (h) => h.temperature?.value ?? -1);
  const fullest = maxBy(up, (h) => h.disk?.percent ?? -1);
  const rx = up.reduce((s, h) => s + (h.network?.rxBps ?? 0), 0);
  const tx = up.reduce((s, h) => s + (h.network?.txBps ?? 0), 0);
  const visible = ordered.slice(0, MAX_VISIBLE);

  return (
    <div className="mv-stack">
      <div className="mv-summary">
        <LevelChip level={up.length === hosts.length ? 'ok' : 'critical'}>
          {up.length} of {hosts.length} up
        </LevelChip>
        {busiest?.cpu?.percent != null && (
          <span>Busiest <b>{busiest.host.name}</b> {Math.round(busiest.cpu.percent)}% CPU</span>
        )}
        {hottest?.temperature?.value != null && (
          <span>Hottest <b>{hottest.host.name}</b> {Math.round(hottest.temperature.value)} °C</span>
        )}
        {fullest?.disk?.percent != null && (
          <span>Fullest <b>{fullest.host.name}</b> {Math.round(fullest.disk.percent)}% disk</span>
        )}
        <span>Traffic <b>↓ {formatByteRate(rx)} ↑ {formatByteRate(tx)}</b></span>
        <SegmentedControl
          aria-label="Order hosts by"
          className="ui-seg ml-auto"
          value={sort}
          onValueChange={(next) => {
            if (!next) return;
            setSort(next as Sort);
            try { localStorage.setItem(SORT_KEY, next); } catch { /* not persisted */ }
          }}
        >
          <SegmentedControlIndicator />
          <SegmentedControlItem value="attention" className="ui-seg-item">Needs attention first</SegmentedControlItem>
          <SegmentedControlItem value="name" className="ui-seg-item">Name</SegmentedControlItem>
        </SegmentedControl>
      </div>

      <div className="mv-hosts">
        {visible.map((h) => <HostCard key={h.host.id} host={h} />)}
      </div>
      {ordered.length > MAX_VISIBLE && (
        <p className="mv-empty">
          +{ordered.length - MAX_VISIBLE} more hosts
          {sort === 'attention' ? ', all healthier than the ones shown.' : ' further down the alphabet. Order by “Needs attention first” to see problems first.'}
        </p>
      )}
    </div>
  );
}

function maxBy<T>(list: T[], key: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestV = -Infinity;
  for (const item of list) {
    const v = key(item);
    if (v > bestV) { best = item; bestV = v; }
  }
  return bestV >= 0 ? best : undefined;
}

function HostCard({ host: h }: { host: HostSnapshot }) {
  const down = h.status === 'down';
  const level = hostLevel(h);
  const cpu = h.cpu?.percent ?? null;
  const cores = h.cpu?.cores ?? null;
  const load1 = h.cpu?.load?.['1m'] ?? null;
  const t = h.temperature;
  const tLevel = temperatureLevel(t?.value, t?.warning ?? 70, t?.critical ?? 85);
  const containers = h.containers ?? [];
  const unhealthy = containers.filter((c) => c.health === 'unhealthy' || c.state === 'restarting' || c.state === 'dead').length;
  const series = useSeries(`host.${h.host.id}.cpu`);
  const os = h.system?.distro || h.system?.platform || '';
  const uptime = h.uptime?.seconds != null ? formatDuration(h.uptime.seconds, { compact: true }) : h.uptime?.formatted || '—';

  const chip = down
    ? <LevelChip level="critical">Down</LevelChip>
    : level === 'critical' ? <LevelChip level="critical">Critical</LevelChip>
    : level === 'warn' ? <LevelChip level="warn">Attention</LevelChip>
    : <LevelChip level="ok">OK</LevelChip>;

  return (
    <article className="mv-host" data-down={down || undefined} aria-label={h.host.name}>
      <header className="mv-host-head">
        <Dot tone={down ? 'danger' : level === 'ok' ? 'success' : level ? 'warning' : 'muted'} />
        <h3 className="mv-host-name">{h.host.name}</h3>
        {os ? <span className="mv-host-os">{os}</span> : null}
        <span className="ml-auto">{chip}</span>
      </header>

      {h.error ? (
        <p className="mv-host-error">
          <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
          <span>{h.error}{down ? '. Showing the last values.' : ''}</span>
        </p>
      ) : null}

      <div className="mv-host-cpu">
        <LevelMeter label="CPU" detail={cores ? `${cores} cores` : undefined} value={cpu} />
        {!down && series.length > 1 && (
          <Sparkline series={series} min={0} max={100} tone={usageLevel(cpu) === 'ok' ? 'primary' : 'warning'} className="mv-host-spark" />
        )}
      </div>
      <LevelMeter
        label="Memory"
        detail={h.memory?.total ? `${formatBytesBinary(h.memory.used)} / ${formatBytesBinary(h.memory.total)}` : undefined}
        value={h.memory?.percent ?? null}
        level={usageLevel(h.memory?.percent, 85, 95)}
      />
      <LevelMeter
        label="Disk"
        detail={h.disk?.total ? `${formatBytesBinary(h.disk.used)} / ${formatBytesBinary(h.disk.total)}` : undefined}
        value={h.disk?.percent ?? null}
      />

      <dl className="mv-host-foot">
        <div>
          <dt>Load</dt>
          <dd>
            {load1 != null ? load1.toFixed(1) : '—'}
            {load1 != null && cores ? <span className="mv-faint"> ({Math.round((load1 / cores) * 100)}%)</span> : null}
          </dd>
        </div>
        <div><dt>Up</dt><dd>{uptime}</dd></div>
        <div>
          <dt>Temp</dt>
          <dd>
            {t?.value != null ? (
              <LevelChip level={tLevel} title={t.label ? `${t.label}${t.max != null ? ` · max ${Math.round(t.max)} °C` : ''}` : undefined}>
                {Math.round(t.value)} °C
              </LevelChip>
            ) : '—'}
          </dd>
        </div>
        <div>
          <dt className="ui-sr-only">Network</dt>
          <dd>↓{formatByteRate(h.network?.rxBps ?? null)} ↑{formatByteRate(h.network?.txBps ?? null)}</dd>
        </div>
        <div>
          <dt>Docker</dt>
          <dd>
            {containers.length === 0 ? <span className="mv-faint">none</span> : containers.length}
            {unhealthy ? <LevelChip level="warn">{unhealthy} unhealthy</LevelChip> : null}
          </dd>
        </div>
      </dl>
    </article>
  );
}
