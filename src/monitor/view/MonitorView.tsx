import { useEffect, useMemo, useState } from 'react';
import { Globe, Home, Maximize2, Minimize2, Server, Settings2, Tv, Zap } from 'lucide-react';
import { Tabs, TabsList, TabsPanel, TabsTab, TabsTabIcon } from '@ui-sdk/react/tabs';
import { IconButton, InlineAlert, recordSamples } from '../../components/ui';
import { Button } from '../../components/ui/Button';
import { useShell } from '../../components/shell/AppShell';
import { useMonitorOverview } from '../useMonitorOverview';
import { useTabRotation, type MonitorTab } from '../useTabRotation';
import { stripHtml } from '../format';
import { collectIssues } from '../issues';
import { SummaryTiles } from './SummaryTiles';
import { AlertsRail } from './AlertsRail';
import { ServerTab } from './ServerTab';
import { HomeTab } from './HomeTab';
import { MediaTab } from './MediaTab';
import { NetworkTab } from './NetworkTab';
import { PowerTab } from './PowerTab';

const TABS: { key: MonitorTab; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'server', label: 'Server', icon: Server },
  { key: 'media', label: 'Media', icon: Tv },
  { key: 'network', label: 'Network', icon: Globe },
  { key: 'power', label: 'Power', icon: Zap },
];

const STATUS_TEXT = { ok: 'All systems normal', degraded: 'Degraded', critical: 'Critical', unknown: 'Unknown' } as const;
const STATUS_TONE = { ok: 'success', degraded: 'warning', critical: 'danger', unknown: undefined } as const;

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <time className="mv-clock-time" dateTime={now.toISOString()}>
      {now.toTimeString().slice(0, 8)}
    </time>
  );
}

function useFullscreen(): [boolean, () => void, () => void] {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const enter = () => { void document.documentElement.requestFullscreen?.().catch(() => {}); };
  const exit = () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };
  return [on, enter, exit];
}

/** The monitor as a view in the app: live status, four headline tiles, rotating tabs and the alerts rail. */
export function MonitorView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { overview, isLoading, error, lastUpdated } = useMonitorOverview();
  const { mode, setMode } = useShell();
  const [fullscreen, enterFullscreen, exitFullscreen] = useFullscreen();
  const rotationSeconds = overview?.tabRotationSeconds ?? 15;
  const { activeTab, switchTab, remainingSeconds, isPaused } = useTabRotation({ rotationSeconds });
  const kiosk = mode === 'hidden' && fullscreen;

  // Feed the last-hour trends once per snapshot.
  useEffect(() => {
    if (!overview) return;
    const at = overview.timestamp || Date.now();
    const values: Record<string, number | null | undefined> = {
      'solar.pv': overview.solar?.pvPowerW,
      'solar.load': overview.solar?.loadPowerW,
      'solar.battery': overview.solar?.batteryPowerW,
      'solar.grid': overview.solar?.gridPowerW,
    };
    for (const h of overview.hosts) {
      if (h.status !== 'down') values[`host.${h.host.id}.cpu`] = h.cpu?.percent;
    }
    recordSamples(at, values);
  }, [overview]);

  const status = error ? 'unknown' : overview?.globalStatus ?? 'unknown';
  const firing = overview?.alerts?.firing ?? [];
  const issues = useMemo(() => collectIssues(overview), [overview]);
  const updated = lastUpdated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const pollSeconds = Math.round((overview?.pollIntervalMs ?? 5000) / 1000);
  const banner = useMemo(() => {
    const critical = firing.filter((a) => a.severity === 'critical');
    return critical[0] ?? null;
  }, [firing]);

  const mediaBadge = useMemo(() => {
    const m = overview?.media;
    const dl = overview?.usenet?.instances.reduce((s, i) => s + (!i.paused && (i.speedBps ?? 0) > 0 ? 1 : 0), 0) ?? 0;
    if (!m && !dl) return null;
    return `${m?.activeStreams ?? 0} playing${dl ? ` · ${dl} downloading` : ''}`;
  }, [overview]);

  const subtitle = isLoading
    ? 'Connecting…'
    : error
      ? updated ? `Connection lost. Showing data from ${updated}.` : 'Connection lost. No data received yet.'
      : overview
        ? [
            `${overview.hosts.length} ${overview.hosts.length === 1 ? 'server' : 'servers'}`,
            overview.docker.total ? `${overview.docker.total} containers` : null,
          ].filter(Boolean).join(' · ')
        : 'Waiting for data…';

  const toggleKiosk = () => {
    if (kiosk) {
      exitFullscreen();
      setMode('expanded');
    } else {
      setMode('hidden');
      enterFullscreen();
    }
  };

  const rotating = rotationSeconds > 0 && !isPaused;
  const progress = rotationSeconds > 0 && remainingSeconds > 0
    ? isPaused ? 1 : 1 - (remainingSeconds - 1) / rotationSeconds
    : 0;

  return (
    <div className="mv" data-kiosk={kiosk || undefined}>
      <header className="mv-head">
        <div className="min-w-0">
          <h1 className="mv-title">Monitor</h1>
          <p className="mv-sub">{subtitle}</p>
        </div>
        <div className="mv-head-actions">
          {!isLoading && (
            <span className="ui-chip mv-status" data-tone={STATUS_TONE[status]}>
              <span className="ui-live-dot" aria-hidden="true" />
              {error ? 'Offline' : STATUS_TEXT[status]}
              {!error && firing.length > 0 ? ` · ${firing.length} firing` : !error && issues.length > 0 && status !== 'ok' ? ` · ${issues.length} to check` : ''}
            </span>
          )}
          <IconButton label="Monitor settings" onClick={onOpenSettings}>
            <Settings2 className="size-4" />
          </IconButton>
          <Button variant="secondary" size="sm" onClick={toggleKiosk}>
            {kiosk ? <Minimize2 className="size-3.5" aria-hidden="true" /> : <Maximize2 className="size-3.5" aria-hidden="true" />}
            {kiosk ? 'Exit kiosk' : 'Kiosk'}
          </Button>
          <div className="mv-clock">
            <Clock />
            <span className="mv-clock-sub">{error ? (updated ? `stale · ${updated}` : 'disconnected') : `polled every ${pollSeconds}s`}</span>
          </div>
        </div>
      </header>

      {error && !isLoading && (
        <InlineAlert tone="warning" title="The monitor can't reach the server">
          {updated ? `Everything below is from ${updated}. It will refresh on its own once the connection is back.` : error}
        </InlineAlert>
      )}
      {banner && !error && (
        <InlineAlert
          tone="danger"
          title={stripHtml(banner.message) || banner.name}
          actions={firing.length > 1 ? <span className="mv-faint text-xs">+{firing.length - 1} more in Alerts</span> : null}
        />
      )}

      <SummaryTiles overview={overview} />

      <div className="mv-body">
        <Tabs
          className="mv-tabs"
          value={activeTab}
          onValueChange={(next) => { if (next) switchTab(next as MonitorTab, true); }}
        >
          <div className="mv-tabs-bar">
            <TabsList aria-label="Monitor sections" className="mv-tablist">
              {TABS.map(({ key, label, icon: Icon }) => (
                <TabsTab key={key} value={key} className="mv-tab">
                  <TabsTabIcon><Icon className="size-3.5" /></TabsTabIcon>
                  {label}
                  {key === 'media' && mediaBadge ? <span className="ui-chip mv-tab-chip" data-tone="info">{mediaBadge}</span> : null}
                  {key === activeTab && rotationSeconds > 0 ? (
                    <span className="mv-tab-progress" data-paused={!rotating || undefined} aria-hidden="true">
                      <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }} />
                    </span>
                  ) : null}
                </TabsTab>
              ))}
            </TabsList>
            <span className="mv-rotation" aria-live="off">
              {rotationSeconds <= 0
                ? 'Rotation off'
                : isPaused
                  ? <span className="ui-chip">Paused · resumes in {remainingSeconds}s</span>
                  : `Next tab in ${remainingSeconds}s`}
            </span>
          </div>

          <TabsPanel value="home" className="mv-tabpanel"><HomeTab ha={overview?.homeassistant ?? null} /></TabsPanel>
          <TabsPanel value="server" className="mv-tabpanel"><ServerTab hosts={overview?.hosts ?? []} /></TabsPanel>
          <TabsPanel value="media" className="mv-tabpanel">
            <MediaTab media={overview?.media ?? null} usenet={overview?.usenet ?? null} arr={overview?.arr ?? null} seerr={overview?.seerr ?? null} />
          </TabsPanel>
          <TabsPanel value="network" className="mv-tabpanel">
            <NetworkTab opnsense={overview?.opnsense ?? null} ntopng={overview?.ntopng ?? null} certificates={overview?.certificates ?? null} />
          </TabsPanel>
          <TabsPanel value="power" className="mv-tabpanel"><PowerTab solar={overview?.solar ?? null} /></TabsPanel>
        </Tabs>

        <AlertsRail firing={firing} resolved={overview?.alerts?.recentlyResolved ?? []} issues={issues} />
      </div>
    </div>
  );
}
