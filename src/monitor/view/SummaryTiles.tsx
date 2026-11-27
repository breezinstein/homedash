import { Box, House, Shield, Sun } from 'lucide-react';
import type { MonitorOverview } from '../../types';
import { RingMeter, StatTile } from '../../components/ui';
import { reserveLevel, usageLevel } from '../../lib/levels';
import { batteryCharging, formatBitRate, formatRuntime } from '../format';
import { activeWanSaturation } from '../wan';
import { Chip, formatPower, splitUnit } from './parts';

function NotConfigured({ label, icon }: { label: string; icon: typeof Sun }) {
  return (
    <StatTile label={label} icon={icon} chip={<Chip>Not configured</Chip>} detail="Add it in Settings to see it here." />
  );
}

/** The four headline tiles above the tabs: power, Docker, firewall and home. */
export function SummaryTiles({ overview }: { overview: MonitorOverview | null }) {
  return (
    <div className="mv-tiles">
      <PowerTile overview={overview} />
      <DockerTile overview={overview} />
      <FirewallTile overview={overview} />
      <HomeTile overview={overview} />
    </div>
  );
}

function PowerTile({ overview }: { overview: MonitorOverview | null }) {
  const solar = overview?.solar;
  if (!solar) return <NotConfigured label="Power" icon={Sun} />;
  const charging = batteryCharging(solar.batteryPowerW);
  const discharging = solar.batteryPowerW != null && solar.batteryPowerW < -5;
  const runtime = formatRuntime(solar.batteryRuntimeMins);
  const state = solar.status === 'down' ? 'Offline' : charging ? 'Charging' : discharging ? 'Discharging' : 'Idle';
  return (
    <StatTile
      label="Power"
      icon={Sun}
      chip={<Chip tone={solar.status === 'down' ? 'danger' : charging ? 'success' : discharging ? 'warning' : undefined}>{state}</Chip>}
      value={splitUnit(formatPower(solar.pvPowerW))[0]}
      unit={`${splitUnit(formatPower(solar.pvPowerW))[1] || 'W'} solar`}
      aside={<RingMeter label="Battery charge" value={solar.batterySocPercent} level={reserveLevel(solar.batterySocPercent)} />}
      detail={`House ${formatPower(solar.loadPowerW)} · ${charging ? 'full in' : 'lasts'} ${runtime.text}`}
    />
  );
}

function DockerTile({ overview }: { overview: MonitorOverview | null }) {
  const d = overview?.docker;
  if (!d || d.total === 0) return <NotConfigured label="Docker" icon={Box} />;
  const issues = d.unhealthy + d.restarting;
  const healthyPct = d.total ? ((d.total - issues) / d.total) * 100 : null;
  const names = d.problems.slice(0, 2).map((p) => p.name).join(', ');
  return (
    <StatTile
      label="Docker"
      icon={Box}
      chip={issues ? <Chip tone="warning">{issues} unhealthy</Chip> : <Chip tone="success">Healthy</Chip>}
      value={d.running}
      unit={`/ ${d.total} running`}
      aside={<RingMeter label="Healthy containers" value={healthyPct} level={issues ? 'warn' : 'ok'} />}
      detail={issues ? `${names}${d.problems.length > 2 ? ` +${d.problems.length - 2}` : ''}` : `${d.healthy} report a health check`}
    />
  );
}

function FirewallTile({ overview }: { overview: MonitorOverview | null }) {
  const opn = overview?.opnsense;
  if (!opn) return <NotConfigured label="Firewall" icon={Shield} />;
  const sat = activeWanSaturation(opn);
  const down = opn.wanInterfaces.filter((w) => !/^up$/i.test(w.status));
  const level = usageLevel(sat.percent);
  return (
    <StatTile
      label={opn.hostname || 'OPNsense'}
      icon={Shield}
      chip={
        opn.status === 'down' ? <Chip tone="danger">Offline</Chip>
          : down.length ? <Chip tone="danger">{down.map((w) => w.description || w.name).join(', ')} down</Chip>
          : <Chip tone="success">{opn.wanInterfaces.length} WAN up</Chip>
      }
      value={splitUnit(formatBitRate(sat.wanInBps))[0]}
      unit={`${splitUnit(formatBitRate(sat.wanInBps))[1]} down`}
      aside={<RingMeter label="Active WAN load" value={sat.percent} level={level === 'ok' ? 'info' : level} />}
      detail={`${formatBitRate(sat.wanOutBps)} up · ${sat.wan ? (sat.wan.description || sat.wan.name) : 'no active WAN'}`}
    />
  );
}

function HomeTile({ overview }: { overview: MonitorOverview | null }) {
  const ha = overview?.homeassistant;
  if (!ha) return <NotConfigured label="Home" icon={House} />;
  const lights = ha.metrics.find((m) => m.key === 'lights');
  const temp = ha.metrics.find((m) => m.key === 'temperature');
  const online = ha.entityCount ? ((ha.entityCount - ha.unavailable.count) / ha.entityCount) * 100 : null;
  return (
    <StatTile
      label={ha.locationName || 'Home'}
      icon={House}
      chip={
        ha.status === 'down' ? <Chip tone="danger">Offline</Chip>
          : ha.unavailable.count ? <Chip tone="warning">{ha.unavailable.count} unavailable</Chip>
          : <Chip tone="success">All online</Chip>
      }
      value={lights?.value ?? ha.onCount}
      unit={lights ? 'lights on' : 'entities on'}
      aside={<RingMeter label="Devices online" value={online} level={ha.unavailable.count ? 'warn' : 'ok'} />}
      detail={[
        temp ? `${temp.value}${temp.unit ? ` ${temp.unit}` : ''} inside` : null,
        ha.pump.present ? `pump ${ha.pump.running ? 'running' : 'off'}` : null,
      ].filter(Boolean).join(' · ') || `${ha.entityCount} entities`}
    />
  );
}
