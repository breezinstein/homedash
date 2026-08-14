import { useMemo, useState, type ReactNode } from 'react';
import { Sun, Shield, Download, Film, Search } from 'lucide-react';
import { LoginModal } from '../components/LoginModal';
import { useMonitorOverview } from './useMonitorOverview';
import { useTabRotation } from './useTabRotation';
import {
  MonitorHeader,
  AlertBanner,
  HostCard,
  SolarCard,
  DockerCard,
  AlertsRail,
  TabBar,
  UsenetCard,
  ArrCard,
  OpnsenseCard,
} from './components';
import { MonitorSettingsPanel } from './components/MonitorSettingsPanel';
import { HomeStatusCard } from './components/HomeStatusCard';
import { HomePanel } from './components/HomePanel';
import { NetworkPanel } from './components/NetworkPanel';
import { PowerPanel } from './components/PowerPanel';
import { StreamsPanel } from './components/StreamsPanel';
import { SeerrCard } from './components/SeerrCard';
import { MonitorProgress } from './components/MonitorProgress';

const MAX_VISIBLE_HOSTS = 9;

export function MonitorApp() {
  const { overview, isLoading, error, authRequired } = useMonitorOverview();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tabRotationSeconds = overview?.tabRotationSeconds ?? 15;
  const { activeTab, switchTab, remainingSeconds, isPaused } = useTabRotation({
    rotationSeconds: tabRotationSeconds,
  });

  const hosts = overview?.hosts ?? [];
  const visibleHosts = hosts.slice(0, MAX_VISIBLE_HOSTS);
  const hasMoreHosts = hosts.length > MAX_VISIBLE_HOSTS;

  const mediaBadge = useMemo(() => {
    const m = overview?.media;
    if (!m) return undefined;
    const u = overview?.usenet;
    const dlCount = u
      ? u.instances.reduce((s, i) => s + (i.speedBps && i.speedBps > 0 ? 1 : 0), 0)
      : 0;
    return `${m.activeStreams} streams · ${dlCount} downloading`;
  }, [overview]);

  if (authRequired) {
    return (
      <div className="min-h-dvh bg-[#121215] flex items-center justify-center">
        <LoginModal forced />
      </div>
    );
  }

  const bannerAlerts = overview?.alerts?.firing ?? [];

  return (
    <div
      className="monitor-shell"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <MonitorHeader
        overview={overview}
        isLoading={isLoading}
        connectionError={error}
        onSettings={() => setSettingsOpen(true)}
      />
      <AlertBanner alerts={bannerAlerts} />

      {/* ── Top row: 4 summary cards ── */}
      <div className="top-grid">
        {overview?.solar && <SolarCard solar={overview.solar} />}
        {!overview?.solar && (
          <CardPlaceholder title="Power" subtitle="Solar Assistant" icon={<Sun className="w-4 h-4" />} iconClass="card-icon-green" message="No solar data source configured" />
        )}

        <DockerCard docker={overview?.docker ?? emptyDocker} />

        {overview?.opnsense ? (
          <OpnsenseCard opnsense={overview.opnsense} />
        ) : (
          <CardPlaceholder title="OPNsense" subtitle="Multi-WAN" icon={<Shield className="w-4 h-4" />} iconClass="card-icon-orange" message="No OPNsense data source configured" />
        )}

        <HomeStatusCard homeAssistant={overview?.homeassistant ?? null} />
      </div>

      {/* ── Bottom section: server content + alerts ── */}
      <div className="bottom-grid">
        {/* Left: server container with tabs */}
        <div className="server-container">
          <TabBar
            activeTab={activeTab}
            onSwitch={(t) => switchTab(t, true)}
            remainingSeconds={remainingSeconds}
            mediaBadge={mediaBadge}
          />

          {/* Home tab */}
          {activeTab === 'home' && (
            <div className="network-panel">
              <HomePanel homeAssistant={overview?.homeassistant ?? null} />
            </div>
          )}

          {/* Server tab: 3×3 host grid */}
          {activeTab === 'server' && (
            <div className="nodes-grid">
              {visibleHosts.map((h) => (
                <HostCard key={h.host.id} host={h} />
              ))}
              {visibleHosts.length === 0 && (
                <div className="empty-grid-msg">No hosts configured</div>
              )}
              {hasMoreHosts && (
                <div className="empty-grid-msg">
                  +{hosts.length - MAX_VISIBLE_HOSTS} more hosts
                </div>
              )}
            </div>
          )}

          {/* Media tab */}
          {activeTab === 'media' && (
            <div className="media-v2">
              <div className="media-v2-grid">
                {/* Top-left: Active Streams */}
                <div className="media-v2-card">
                  {overview?.media ? (
                    <StreamsPanel media={overview.media} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[var(--mon-text-muted)] text-[12px]">
                      No active streams
                    </div>
                  )}
                </div>

                {/* Top-right: Downloads */}
                <div className="media-v2-card">
                  {overview?.usenet ? (
                    <UsenetCard usenet={overview.usenet} />
                  ) : (
                    <CardPlaceholder title="Downloads" subtitle="Usenet" icon={<Download className="w-4 h-4" />} message="Not configured" fillHeight bodyHeight={80} />
                  )}
                </div>

                {/* Bottom-left: Sonarr / Radarr */}
                <div className="media-v2-card">
                  {overview?.arr ? (
                    <ArrCard arr={overview.arr} />
                  ) : (
                    <CardPlaceholder title="Sonarr / Radarr" subtitle="Arr" icon={<Film className="w-4 h-4" />} message="Not configured" fillHeight bodyHeight={80} />
                  )}
                </div>

                {/* Bottom-right: Seerr */}
                <div className="media-v2-card">
                  {overview?.seerr ? (
                    <SeerrCard seerr={overview.seerr} />
                  ) : (
                    <CardPlaceholder title="Seerr" subtitle="Overseerr / Jellyseerr" icon={<Search className="w-4 h-4" />} message="Not configured" fillHeight bodyHeight={80} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Network tab */}
          {activeTab === 'network' && (
            <div className="network-panel">
              {overview?.opnsense || overview?.ntopng ? (
                <NetworkPanel opnsense={overview.opnsense} ntopng={overview.ntopng} />
              ) : (
                <div className="empty-grid-msg">
                  No network appliances configured
                </div>
              )}
            </div>
          )}

          {/* Power tab */}
          {activeTab === 'power' && (
            <div className="power-tab">
              {overview?.solar ? (
                <PowerPanel solar={overview.solar} />
              ) : (
                <div className="empty-grid-msg">
                  No solar/inverter data source configured
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: alerts sidebar */}
        <AlertsRail
          firing={overview?.alerts?.firing ?? []}
          recentlyResolved={overview?.alerts?.recentlyResolved ?? []}
        />
      </div>

      {/* Autorotate progress along the bottom screen edge */}
      <MonitorProgress
        rotationSeconds={tabRotationSeconds}
        remainingSeconds={remainingSeconds}
        paused={isPaused}
      />

      {/* Full-screen monitor settings (admin) */}
      {settingsOpen && <MonitorSettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

/* ── Placeholder cards (shown when data source is unavailable) ── */

function CardPlaceholder({
  title, subtitle, icon, iconClass = 'card-icon-purple', message, fillHeight = false, bodyHeight = 100,
}: {
  title: string; subtitle: string; icon?: ReactNode; iconClass?: string; message: string;
  fillHeight?: boolean; bodyHeight?: number;
}) {
  const Tag = fillHeight ? 'div' : 'section';
  return (
    <Tag className="card" style={fillHeight ? { height: '100%' } : undefined}>
      <div className="card-header">
        <div className="card-title-row">
          {icon && <span className={`card-icon ${iconClass}`}>{icon}</span>}
          <div className="title-group">
            <span className="title">{title}</span>
            <span className="subtitle">{subtitle}</span>
          </div>
        </div>
        <span className="status-ok" style={{ opacity: 0.4 }}>offline</span>
      </div>
      <div
        className="flex items-center justify-center text-[var(--mon-text-muted)] text-[12px]"
        style={{ height: bodyHeight }}
      >
        {message}
      </div>
    </Tag>
  );
}

/* ── Helper ── */

const emptyDocker = {
  status: 'ok' as const,
  total: 0,
  running: 0,
  healthy: 0,
  unhealthy: 0,
  restarting: 0,
  problems: [] as any[],
};
