import { useMemo } from 'react';
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
import { HomeStatusCard } from './components/HomeStatusCard';
import { NetworkPanel } from './components/NetworkPanel';
import { PowerPanel } from './components/PowerPanel';
import { StreamsPanel } from './components/StreamsPanel';
import { SeerrCard } from './components/SeerrCard';
import { MonitorProgress } from './components/MonitorProgress';

const MAX_VISIBLE_HOSTS = 9;

export function MonitorApp() {
  const { overview, isLoading, error, authRequired } = useMonitorOverview();

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
      <div className="min-h-dvh bg-[#121213] flex items-center justify-center">
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
      />
      <AlertBanner alerts={bannerAlerts} />

      {/* ── Top row: 4 summary cards ── */}
      <div className="top-grid">
        {overview?.solar && <SolarCard solar={overview.solar} />}
        {!overview?.solar && <SolarCardPlaceholder />}

        <DockerCard docker={overview?.docker ?? emptyDocker} />

        {overview?.opnsense ? (
          <OpnsenseCard opnsense={overview.opnsense} />
        ) : (
          <OpnsenseCardPlaceholder />
        )}

        <HomeStatusCard />
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
                    <div className="flex items-center justify-center h-full text-[#a0a0a0] text-[12px]">
                      No active streams
                    </div>
                  )}
                </div>

                {/* Top-right: Downloads */}
                <div className="media-v2-card">
                  {overview?.usenet ? (
                    <UsenetCard usenet={overview.usenet} />
                  ) : (
                    <MediaPlaceholder title="Downloads" subtitle="Usenet" icon="⬇" />
                  )}
                </div>

                {/* Bottom-left: Sonarr / Radarr */}
                <div className="media-v2-card">
                  {overview?.arr ? (
                    <ArrCard arr={overview.arr} />
                  ) : (
                    <MediaPlaceholder title="Sonarr / Radarr" subtitle="Arr" icon="🎬" />
                  )}
                </div>

                {/* Bottom-right: Seerr */}
                <div className="media-v2-card">
                  {overview?.seerr ? (
                    <SeerrCard seerr={overview.seerr} />
                  ) : (
                    <MediaPlaceholder title="Seerr" subtitle="Overseerr / Jellyseerr" icon="🔍" />
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
    </div>
  );
}

/* ── Placeholder cards (shown when data source is unavailable) ── */

function SolarCardPlaceholder() {
  return (
    <section className="card">
      <div className="card-header">
        <div className="title-group">
          <span className="title">Power</span>
          <span className="subtitle">Solar Assistant</span>
        </div>
        <span className="status-ok" style={{ opacity: 0.4 }}>
          offline
        </span>
      </div>
      <div className="flex items-center justify-center h-[100px] text-[#a0a0a0] text-[12px]">
        No solar data source configured
      </div>
    </section>
  );
}

function OpnsenseCardPlaceholder() {
  return (
    <section className="card">
      <div className="card-header">
        <div className="title-group">
          <span className="title">OPNsense</span>
          <span className="subtitle">Multi-WAN</span>
        </div>
        <span className="status-ok" style={{ opacity: 0.4 }}>
          offline
        </span>
      </div>
      <div className="flex items-center justify-center h-[100px] text-[#a0a0a0] text-[12px]">
        No OPNsense data source configured
      </div>
    </section>
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

/* ── Media placeholder ── */

function MediaPlaceholder({ title, subtitle, icon }: { title: string; subtitle: string; icon: string }) {
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        <div className="title-group">
          <span className="title">{icon} {title}</span>
          <span className="subtitle">{subtitle}</span>
        </div>
        <span className="status-ok" style={{ opacity: 0.4 }}>offline</span>
      </div>
      <div className="flex items-center justify-center h-[80px] text-[#a0a0a0] text-[12px]">
        Not configured
      </div>
    </div>
  );
}
