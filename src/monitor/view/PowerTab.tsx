import { Battery, BatteryCharging, Plug, Sun, UtilityPole, Zap } from 'lucide-react';
import type { BatteryDetail, InverterDetail, SolarSnapshot } from '../../types';
import { InlineAlert, LevelMeter, RingMeter, Sparkline, useSeries } from '../../components/ui';
import { cellSpreadLevel, reserveLevel, temperatureLevel, usageLevel } from '../../lib/levels';
import { batteryCharging, formatRuntime } from '../format';
import { Chip, Empty, LevelChip, MonPanel, SectionLabel, fmt, formatPower } from './parts';

const FLOW_W = 5;

/** Energy flow, the battery bank with last-hour trends, then every inverter and battery pack. */
export function PowerTab({ solar }: { solar: SolarSnapshot | null }) {
  if (!solar) return <Empty>Turn on Solar and energy in Settings and add a Solar Assistant device under Inverters.</Empty>;
  const inverters = solar.inverters ?? [];
  const batteries = solar.batteries ?? [];
  const capacity = batteries.reduce((s, b) => s + (b.capacityAh ?? 0), 0);

  return (
    <div className="mv-stack">
      {solar.status === 'down' && <InlineAlert tone="danger">{solar.error || 'Solar Assistant is not answering.'} Showing the last values.</InlineAlert>}
      <div className="mv-power-top">
        <EnergyFlow solar={solar} />
        <BatteryBank solar={solar} />
      </div>

      {inverters.length > 0 && (
        <>
          <SectionLabel count={inverters.length}>Inverters</SectionLabel>
          <div className="mv-cards" data-compact={inverters.length > 2 || undefined}>
            {inverters.map((inv) => <InverterCard key={inv.id} inv={inv} compact={inverters.length > 2} />)}
          </div>
        </>
      )}
      {batteries.length > 0 && (
        <>
          <SectionLabel count={`${batteries.length} ${batteries.length === 1 ? 'pack' : 'packs'}${capacity ? ` · ${fmt(capacity, 'Ah', 0)}` : ''}`}>Batteries</SectionLabel>
          <div className="mv-cards" data-compact={batteries.length > 2 || undefined}>
            {batteries.map((b) => <BatteryCard key={b.id} battery={b} compact={batteries.length > 2} />)}
          </div>
        </>
      )}
    </div>
  );
}

function flowDir(w: number | null | undefined, positive: 'in' | 'out'): 'in' | 'out' | undefined {
  if (w == null || Math.abs(w) <= FLOW_W) return undefined;
  if (w > 0) return positive;
  return positive === 'in' ? 'out' : 'in';
}

/** Solar, grid, inverters, house and battery, with moving lines along live power. */
function EnergyFlow({ solar }: { solar: SolarSnapshot }) {
  const inverters = solar.inverters ?? [];
  const rated = inverters.reduce((s, i) => s + (i.maxAcOutputApparentPowerVa ?? i.maxAcOutputPowerW ?? 0), 0);
  const drawn = inverters.reduce((s, i) => s + (i.loadApparentPowerVa ?? i.loadPowerW ?? 0), 0);
  const maxTemp = inverters.reduce<number | null>((m, i) => (i.temperature != null && (m == null || i.temperature > m) ? i.temperature : m), null);
  const pvV = inverters.map((i) => i.pvVoltage).filter((v): v is number => v != null).map((v) => Math.round(v));
  const grid0 = inverters.find((i) => i.gridVoltage != null);
  const ac0 = inverters.find((i) => i.acOutputVoltage != null);
  const soc = solar.batterySocPercent;
  const charging = batteryCharging(solar.batteryPowerW);
  const discharging = solar.batteryPowerW != null && solar.batteryPowerW < -FLOW_W;
  const gridDir = flowDir(solar.gridPowerW, 'in');
  const battDir = flowDir(solar.batteryPowerW, 'out');
  const gridLive = !!grid0 && (grid0.gridVoltage ?? 0) > 50;
  const gridSub = gridDir
    ? `${gridDir === 'in' ? 'Importing' : 'Exporting'}${gridLive ? ` · ${fmt(grid0?.gridVoltage, 'V', 0)}` : ''}`
    : gridLive ? `Idle · ${fmt(grid0?.gridVoltage, 'V', 0)} · ${fmt(grid0?.gridFrequency, 'Hz', 1)}` : 'No supply';

  const description = [
    `Solar ${formatPower(solar.pvPowerW)}`,
    `house ${formatPower(solar.loadPowerW)}`,
    charging ? `battery charging at ${formatPower(solar.batteryPowerW)}` : discharging ? `battery supplying ${formatPower(Math.abs(solar.batteryPowerW ?? 0))}` : 'battery idle',
    gridDir === 'in' ? `importing ${formatPower(solar.gridPowerW)} from the grid` : gridDir === 'out' ? `exporting ${formatPower(Math.abs(solar.gridPowerW ?? 0))}` : 'grid idle',
  ].join(', ');

  const node = (x: number, y: number, label: string, value: string, sub: string, dim = false, hub = false) => (
    <g>
      <rect className="mv-flow-node" data-hub={hub || undefined} x={x} y={y} width="150" height="68" rx="12" />
      <text className="mv-flow-label" x={x + 14} y={y + 20}>{label}</text>
      <text className="mv-flow-value" data-dim={dim || undefined} x={x + 14} y={y + 42}>{value}</text>
      <text className="mv-flow-sub" x={x + 14} y={y + 58}>{sub}</text>
    </g>
  );

  return (
    <MonPanel
      title="Energy flow"
      icon={Zap}
      actions={inverters[0]?.deviceMode ? <Chip tone="info">{inverters[0].deviceMode}</Chip> : null}
    >
      <svg className="mv-flow" viewBox="0 0 640 214" role="img" aria-label={description}>
        <path className="mv-flow-line" data-tone="solar" data-dir={(solar.pvPowerW ?? 0) > FLOW_W ? 'out' : undefined} d="M170 46 C212 46 205 96 245 96" />
        <path className="mv-flow-line" data-tone="grid" data-dir={gridDir === 'in' ? 'out' : gridDir === 'out' ? 'in' : undefined} d="M170 168 C212 168 205 118 245 118" />
        <path className="mv-flow-line" data-tone="load" data-dir={(solar.loadPowerW ?? 0) > FLOW_W ? 'out' : undefined} d="M395 96 C435 96 428 46 470 46" />
        <path className="mv-flow-line" data-tone="battery" data-dir={battDir} d="M395 118 C435 118 428 168 470 168" />
        {node(20, 12, 'Solar', formatPower(solar.pvPowerW), pvV.length ? `${pvV.length} ${pvV.length === 1 ? 'string' : 'strings'} · ${pvV.join(' / ')} V` : 'PV input', (solar.pvPowerW ?? 0) <= FLOW_W)}
        {node(20, 134, 'Grid', formatPower(solar.gridPowerW), gridSub, !gridDir)}
        {node(245, 73, `${inverters.length || 1} ${inverters.length === 1 ? 'inverter' : 'inverters'}`, rated ? `${Math.round((drawn / rated) * 100)}% loaded` : formatPower(solar.loadPowerW), rated ? `${fmt(drawn / 1000, '', 2)} / ${fmt(rated / 1000, 'kVA', 0)}${maxTemp != null ? ` · ${Math.round(maxTemp)} °C` : ''}` : '', false, true)}
        {node(470, 12, 'House', formatPower(solar.loadPowerW), ac0 ? `AC ${fmt(ac0.acOutputVoltage, 'V')} · ${fmt(ac0.acOutputFrequency, 'Hz', 2)}` : solar.loadPercent != null ? `${Math.round(solar.loadPercent)}% load` : '')}
        <g>
          <rect className="mv-flow-node" x="470" y="134" width="150" height="68" rx="12" />
          <text className="mv-flow-label" x="484" y="154">Battery{soc != null ? ` · ${Math.round(soc)}%` : ''}</text>
          <text className="mv-flow-value" x="484" y="176">{formatPower(solar.batteryPowerW, true)}</text>
          <rect className="mv-flow-soc-track" x="484" y="186" width="122" height="5" rx="2.5" />
          <rect className="mv-flow-soc" data-level={reserveLevel(soc)} x="484" y="186" width={soc != null ? (122 * Math.max(0, Math.min(100, soc))) / 100 : 0} height="5" rx="2.5" />
        </g>
      </svg>
    </MonPanel>
  );
}

function BatteryBank({ solar }: { solar: SolarSnapshot }) {
  const batteries = solar.batteries ?? [];
  const charging = batteryCharging(solar.batteryPowerW);
  const discharging = solar.batteryPowerW != null && solar.batteryPowerW < -FLOW_W;
  const runtime = formatRuntime(solar.batteryRuntimeMins);
  const cap = batteries.reduce((s, b) => s + (b.capacityAh ?? 0), 0);
  const stored = batteries.reduce((s, b) => s + (b.chargeCapacityAh ?? 0), 0);
  const volts = batteries.map((b) => b.voltage).filter((v): v is number => v != null);
  const amps = batteries.reduce<number | null>((s, b) => (b.currentA != null ? (s ?? 0) + b.currentA : s), null);
  const pv = useSeries('solar.pv');
  const load = useSeries('solar.load');
  const batt = useSeries('solar.battery');
  const grid = useSeries('solar.grid');

  return (
    <MonPanel
      title="Battery bank"
      icon={charging ? BatteryCharging : Battery}
      actions={<Chip tone={charging ? 'success' : discharging ? 'warning' : undefined}>{charging ? 'Charging' : discharging ? 'Discharging' : 'Idle'}</Chip>}
    >
      <div className="mv-bank">
        <div className="ui-tile-row">
          <RingMeter label="Battery charge" size="lg" value={solar.batterySocPercent} level={reserveLevel(solar.batterySocPercent)} />
          <div className="min-w-0">
            <p className="ui-tile-value">
              {runtime.text}
              <span className="ui-tile-unit">{charging ? 'to full' : discharging ? 'left' : ''}</span>
            </p>
            <p className="ui-tile-detail">
              {[
                cap ? `${fmt(stored, '', 0)} of ${fmt(cap, 'Ah', 0)}` : null,
                volts.length ? fmt(volts.reduce((a, b) => a + b, 0) / volts.length, 'V') : null,
                amps != null ? `${amps > 0 ? '+' : ''}${fmt(amps, 'A')}` : null,
              ].filter(Boolean).join(' · ') || formatPower(solar.batteryPowerW, true)}
            </p>
          </div>
        </div>
        <div className="mv-sparks">
          <Trend label="Solar" value={formatPower(solar.pvPowerW)} series={pv} tone="warning" />
          <Trend label="House" value={formatPower(solar.loadPowerW)} series={load} tone="primary" />
          <Trend label="Battery" value={formatPower(solar.batteryPowerW, true)} series={batt} tone="success" />
          <Trend label="Grid" value={formatPower(solar.gridPowerW)} series={grid} tone="muted" />
        </div>
        <p className="mv-legend">Last 60 minutes, kept in this browser since the page opened.</p>
      </div>
    </MonPanel>
  );
}

function Trend({ label, value, series, tone }: { label: string; value: string; series: ReturnType<typeof useSeries>; tone: 'warning' | 'primary' | 'success' | 'muted' }) {
  return (
    <div className="mv-spark">
      <div className="mv-spark-head"><span>{label}</span><b>{value}</b></div>
      {series.length > 1 ? <Sparkline series={series} tone={tone} min={0} /> : <p className="mv-spark-empty">Collecting…</p>}
    </div>
  );
}

function Group({ icon: Icon, title, value, sub, tone }: { icon: typeof Sun; title: string; value: string; sub: string; tone?: 'success' | 'warning' | 'dim' }) {
  return (
    <div className="mv-group">
      <h5 className="mv-group-title"><Icon className="size-3" aria-hidden="true" />{title}</h5>
      <p className="mv-group-value" data-tone={tone}>{value}</p>
      <p className="mv-group-sub">{sub}</p>
    </div>
  );
}

/** One inverter: output against its rating, then PV, battery, AC output and grid on their own. */
export function InverterCard({ inv, compact = false, title }: { inv: InverterDetail; compact?: boolean; title?: string }) {
  const ratedVa = inv.maxAcOutputApparentPowerVa ?? inv.maxAcOutputPowerW ?? null;
  const drawnVa = inv.loadApparentPowerVa ?? inv.loadPowerW ?? null;
  const pct = ratedVa && drawnVa != null ? (drawnVa / ratedVa) * 100 : inv.loadPercent;
  const tLevel = temperatureLevel(inv.temperature, 40, 50);
  const batt = inv.batteryPowerW;
  const battTone = batt != null && batt > FLOW_W ? 'success' : batt != null && batt < -FLOW_W ? 'warning' : 'dim';
  const gen = inv.generatorPowerW != null || inv.generatorVoltage != null;

  return (
    <article className="mv-card" aria-label={title ?? `Inverter ${inv.id}`}>
      <header className="mv-card-head">
        <h4 className="mv-card-title">{title ?? `Inverter ${inv.id}`}</h4>
        {inv.serialNumber && <span className="mv-mono mv-faint">SN {inv.serialNumber}</span>}
        <span className="ml-auto flex flex-wrap justify-end gap-1">
          {inv.deviceMode && <Chip tone="info">{inv.deviceMode}</Chip>}
          {inv.temperature != null && <LevelChip level={tLevel}>{Math.round(inv.temperature)} °C</LevelChip>}
        </span>
      </header>
      <LevelMeter
        label="Output"
        detail={`${formatPower(inv.loadPowerW)}${ratedVa && drawnVa != null ? ` · ${fmt(drawnVa / 1000, '', 2)} of ${fmt(ratedVa / 1000, 'kVA', 1)}` : ''}`}
        value={pct}
        level={usageLevel(pct, 80, 95)}
      />
      {!compact && (
        <div className="mv-groups">
          <Group icon={Sun} title="PV input" value={formatPower(inv.pvPowerW)} sub={inv.pvVoltage != null || inv.pvCurrent != null ? `${fmt(inv.pvVoltage, 'V', 0)} · ${fmt(inv.pvCurrent, 'A', 2)}` : 'No reading'} tone={(inv.pvPowerW ?? 0) > FLOW_W ? undefined : 'dim'} />
          <Group
            icon={Battery}
            title="Battery"
            value={formatPower(batt, true)}
            sub={`${fmt(inv.batteryVoltage, 'V')} · ${inv.batteryCurrent != null && inv.batteryCurrent > 0 ? '+' : ''}${fmt(inv.batteryCurrent, 'A')}${inv.batteryPowerFromAcW != null ? ` · ${formatPower(inv.batteryPowerFromAcW)} from AC` : ''}`}
            tone={battTone}
          />
          <Group icon={Plug} title="AC output" value={fmt(inv.acOutputVoltage, 'V')} sub={`${fmt(inv.acOutputFrequency, 'Hz', 2)} · ${formatPower(inv.loadPowerW)} load`} />
          <Group icon={UtilityPole} title="Grid" value={formatPower(inv.gridPowerW)} sub={(inv.gridVoltage ?? 0) > 50 ? `${fmt(inv.gridVoltage, 'V')} · ${fmt(inv.gridFrequency, 'Hz', 2)}` : 'No supply'} tone={Math.abs(inv.gridPowerW ?? 0) > FLOW_W ? undefined : 'dim'} />
        </div>
      )}
      <dl className="mv-pairs" data-line>
        {compact && <div><dt>PV</dt><dd>{formatPower(inv.pvPowerW)}</dd></div>}
        {compact && <div><dt>Battery</dt><dd>{formatPower(batt, true)}</dd></div>}
        <div><dt>Bus</dt><dd>{fmt(inv.busVoltage, 'V', 0)}</dd></div>
        <div><dt>System</dt><dd>{formatPower(inv.systemPowerW)}</dd></div>
        <div><dt>Generator</dt><dd>{gen ? `${formatPower(inv.generatorPowerW)} · ${fmt(inv.generatorVoltage, 'V')}` : 'not connected'}</dd></div>
      </dl>
    </article>
  );
}

/** The gap between highest and lowest cell in millivolts, whatever unit Solar Assistant used. */
export function cellSpreadMv(b: BatteryDetail): number | null {
  const toMv = (v: number) => (Math.abs(v) < 1 ? v * 1000 : v);
  if (b.cellVoltageImbalance != null && Number.isFinite(b.cellVoltageImbalance)) return Math.round(toMv(b.cellVoltageImbalance));
  if (b.cellVoltageHighest != null && b.cellVoltageLowest != null) {
    const toV = (v: number) => (v > 10 ? v / 1000 : v);
    return Math.round((toV(b.cellVoltageHighest) - toV(b.cellVoltageLowest)) * 1000);
  }
  return null;
}

const CELL_MIN = 2.8;
const CELL_MAX = 3.65;
const TEMP_MAX = 60;

function RangeBar({ low, high, mark, min, max, level, label }: { low: number; high: number; mark?: number | null; min: number; max: number; level?: string; label: string }) {
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const left = pos(low);
  const width = Math.max(0.8, pos(high) - left);
  return (
    <div className="mv-range" data-level={level} role="img" aria-label={label}>
      <span className="mv-range-band" style={{ left: `${left}%`, width: `${width}%` }} />
      {mark != null ? <span className="mv-range-mark" style={{ left: `${pos(mark)}%` }} /> : null}
    </div>
  );
}

/** One battery pack: stored charge, then how far apart its cells are in voltage and temperature. */
export function BatteryCard({ battery: b, compact = false, title }: { battery: BatteryDetail; compact?: boolean; title?: string }) {
  const charging = (b.powerW ?? 0) > FLOW_W;
  const discharging = (b.powerW ?? 0) < -FLOW_W;
  const spread = cellSpreadMv(b);
  const spreadLevel = cellSpreadLevel(spread);
  const toV = (v: number | null) => (v == null ? null : v > 10 ? v / 1000 : v);
  const hi = toV(b.cellVoltageHighest);
  const lo = toV(b.cellVoltageLowest);
  const tLo = b.cellTempLowest;
  const tHi = b.cellTempHighest;
  const tAvg = b.cellTempAverage;
  const soc = b.stateOfChargePercent;

  return (
    <article className="mv-card" aria-label={title ?? `Battery ${b.id}`}>
      <header className="mv-card-head">
        <h4 className="mv-card-title">{title ?? `Battery ${b.id}`}</h4>
        <Chip tone={charging ? 'success' : discharging ? 'warning' : undefined}>
          {charging || discharging ? formatPower(b.powerW, true) : 'Idle'}
        </Chip>
        <span className="mv-soc ml-auto" data-level={reserveLevel(soc)}>{soc != null ? `${Math.round(soc)}%` : '—'}</span>
      </header>
      <LevelMeter
        label={b.chargeCapacityAh != null && b.capacityAh ? `${fmt(b.chargeCapacityAh, '', 0)} of ${fmt(b.capacityAh, 'Ah', 0)} stored` : 'Charge'}
        value={soc}
        level={reserveLevel(soc)}
        className="mv-soc-meter"
      />
      <dl className="mv-pairs" data-line>
        <div><dt>Voltage</dt><dd>{fmt(b.voltage, 'V', 2)}</dd></div>
        <div><dt>Current</dt><dd>{b.currentA != null && b.currentA > 0 ? '+' : ''}{fmt(b.currentA, 'A')}</dd></div>
        <div><dt>Cycles</dt><dd>{fmt(b.cycles, '', 0)}</dd></div>
      </dl>
      {(hi != null && lo != null) || spread != null ? (
        <div className="mv-cell">
          <div className="mv-cell-head">
            <span>Cell voltage</span>
            {hi != null && lo != null && <b className="mv-num">{lo.toFixed(3)} – {hi.toFixed(3)} V</b>}
            {spread != null && <LevelChip level={spreadLevel}>Δ {spread} mV</LevelChip>}
          </div>
          {hi != null && lo != null && !compact && (
            <>
              <RangeBar low={lo} high={hi} min={CELL_MIN} max={CELL_MAX} level={spreadLevel} label={`Cells from ${lo.toFixed(3)} to ${hi.toFixed(3)} volts`} />
              <div className="mv-range-scale"><span>{CELL_MIN.toFixed(2)} V</span><span>{CELL_MAX.toFixed(2)} V</span></div>
            </>
          )}
        </div>
      ) : null}
      {(tLo != null && tHi != null) || b.temperature != null ? (
        <div className="mv-cell">
          <div className="mv-cell-head">
            <span>Cell temperature</span>
            <b className="mv-num">
              {tLo != null && tHi != null ? `${Math.round(tLo)} / ${tAvg != null ? Math.round(tAvg) : '—'} / ${Math.round(tHi)} °C` : fmt(b.temperature, '°C', 0)}
            </b>
            {(b.temperatureMos != null || b.temperatureEnv != null) && (
              <Chip>{[b.temperatureMos != null ? `MOS ${Math.round(b.temperatureMos)} °C` : null, b.temperatureEnv != null ? `air ${Math.round(b.temperatureEnv)} °C` : null].filter(Boolean).join(' · ')}</Chip>
            )}
          </div>
          {tLo != null && tHi != null && !compact && (
            <>
              <RangeBar low={tLo} high={tHi} mark={tAvg} min={0} max={TEMP_MAX} level={temperatureLevel(tHi, 45, 55)} label={`Cells from ${Math.round(tLo)} to ${Math.round(tHi)} degrees`} />
              <div className="mv-range-scale"><span>0 °C</span><span>min / average / max</span><span>{TEMP_MAX} °C</span></div>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
