import { useState, useMemo } from 'react';
import { LoginModal } from '../components/LoginModal';
import { useMonitorOverview } from './useMonitorOverview';
import { useTabRotation } from './useTabRotation';
import { ackAlert } from './monitorApi';
import {
  MonitorHeader,
  AlertBanner,
  HostCard,
  SolarCard,
  DockerCard,
  AlertsRail,
  TabBar,
  StreamsCard,
  UsenetCard,
} from './components';

// Theme CSS variables come from :root, same as the main dashboard.
// The page is a full-screen, dark-first layout targeting ≥1600px.

export function MonitorApp() {
  const { overview, isLoading, error, authRequired } = useMonitorOverview();
  const [showLoginModal, setShowLoginModal] = useState(authRequired);

  const { activeTab, switchTab, remainingSeconds } = useTabRotation({
    rotationSeconds: overview ? 15 : 0, // placeholder until config-driven
  });

  const alertCount = (overview?.alerts?.firing?.length ?? 0);

  const mediaBadge = useMemo(() => {
    const m = overview?.media;
    if (!m) return undefined;
    const u = overview?.usenet;
    const dlCount = u ? u.instances.reduce((s, i) => s + (i.speedBps && i.speedBps > 0 ? 1 : 0), 0) : 0;
    return `${m.activeStreams} · ${dlCount}`;
  }, [overview]);

  // Auth gating
  if (authRequired && !showLoginModal) setShowLoginModal(true);
  if (authRequired) {
    return (
      <div className="min-h-dvh bg-[var(--color-background)] flex items-center justify-center">
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          forced
        />
      </div>
    );
  }

  const bannerAlerts = overview?.alerts?.firing ?? [];

  return (
    <div className="h-dvh bg-[var(--color-background)] text-[var(--color-text-primary)] overflow-hidden flex flex-col"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
      <MonitorHeader
        overview={overview}
        alertCount={alertCount}
        isLoading={isLoading}
        connectionError={error}
      />

      <AlertBanner alerts={bannerAlerts} />

      <TabBar
        activeTab={activeTab}
        onSwitch={switchTab}
        remainingSeconds={remainingSeconds}
        rotationSeconds={15}
        mediaBadge={mediaBadge}
      />

      {/* Infrastructure tab */}
      <main
        className="flex-1 grid gap-[14px] p-[14px_20px_18px] min-h-0"
        style={{
          display: activeTab === 'infra' ? 'grid' : 'none',
          gridTemplateColumns: '1.25fr 1fr 0.95fr',
          gridTemplateRows: '1fr 1fr 1fr',
        }}
      >
        {/* Host cards — column 1 */}
        {(overview?.hosts ?? []).map((h, i) => (
          <div key={h.host.id} style={{ gridColumn: 1, gridRow: i + 1 }}>
            <HostCard host={h} />
          </div>
        ))}

        {/* Middle column: Solar + Docker */}
        <div className="flex flex-col gap-[14px] min-h-0" style={{ gridColumn: 2, gridRow: '1 / span 3' }}>
          {overview?.solar && <SolarCard solar={overview.solar} />}
          <DockerCard docker={overview?.docker ?? { status: 'ok', total: 0, running: 0, healthy: 0, unhealthy: 0, restarting: 0, problems: [] }} />
        </div>

        {/* Alerts rail — column 3 */}
        <div style={{ gridColumn: 3, gridRow: '1 / span 3' }} className="min-h-0">
          <AlertsRail
            firing={overview?.alerts?.firing ?? []}
            recentlyResolved={overview?.alerts?.recentlyResolved ?? []}
            onAck={(id) => { ackAlert(id).catch(() => {}); }}
          />
        </div>
      </main>

      {/* Media & Downloads tab */}
      <main
        className="flex-1 grid gap-[14px] p-[14px_20px_18px] min-h-0"
        style={{
          display: activeTab === 'media' ? 'grid' : 'none',
          gridTemplateColumns: '1.55fr 1fr',
          gridTemplateRows: '1.35fr 1fr',
        }}
      >
        {/* Active streams — spans both rows */}
        <div style={{ gridRow: '1 / span 2' }} className="min-h-0">
          {overview?.media ? (
            <StreamsCard media={overview.media} />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)] text-[13px]">
              No media servers configured
            </div>
          )}
        </div>

        {/* Usenet cards */}
        <div className="flex flex-col gap-[14px] min-h-0" style={{ gridRow: '1 / span 2' }}>
          {overview?.usenet ? (
            <UsenetCard usenet={overview.usenet} />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)] text-[13px]">
              No usenet downloaders configured
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
