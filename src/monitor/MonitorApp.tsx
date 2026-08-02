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
  ArrCard,
  OpnsenseCard,
} from './components';

const HOSTS_PER_PAGE = 3;

export function MonitorApp() {
  const { overview, isLoading, error, authRequired } = useMonitorOverview();
  const [showLoginModal, setShowLoginModal] = useState(authRequired);
  const [hostPage, setHostPage] = useState(0);

  const tabRotation = overview?.tabRotationSeconds ?? 15;
  const hosts = overview?.hosts ?? [];
  const totalPages = Math.max(1, Math.ceil(hosts.length / HOSTS_PER_PAGE));

  // Rotate host pages on the same cadence as tab rotation
  const { activeTab, switchTab, remainingSeconds } = useTabRotation({
    rotationSeconds: hosts.length > HOSTS_PER_PAGE ? Math.max(6, tabRotation / 2) : 0,
  });

  // Override tab rotation to also paginate hosts when on infra tab
  useMemo(() => {
    if (activeTab !== 'infra' || hosts.length <= HOSTS_PER_PAGE) return;
    const id = setInterval(() => {
      setHostPage(p => (p + 1) % totalPages);
    }, Math.max(6000, tabRotation * 500));
    return () => clearInterval(id);
  }, [activeTab, totalPages, tabRotation, hosts.length]);

  const visibleHosts = hosts.slice(hostPage * HOSTS_PER_PAGE, (hostPage + 1) * HOSTS_PER_PAGE);

  const alertCount = (overview?.alerts?.firing?.length ?? 0);

  const mediaBadge = useMemo(() => {
    const m = overview?.media;
    if (!m) return undefined;
    const u = overview?.usenet;
    const dlCount = u ? u.instances.reduce((s, i) => s + (i.speedBps && i.speedBps > 0 ? 1 : 0), 0) : 0;
    return `${m.activeStreams} · ${dlCount}`;
  }, [overview]);

  if (authRequired && !showLoginModal) setShowLoginModal(true);
  if (authRequired) {
    return (
      <div className="min-h-dvh bg-[var(--color-background)] flex items-center justify-center">
        <LoginModal onClose={() => setShowLoginModal(false)} forced />
      </div>
    );
  }

  const bannerAlerts = overview?.alerts?.firing ?? [];

  return (
    <div className="h-dvh bg-[var(--color-background)] text-[var(--color-text-primary)] overflow-hidden flex flex-col"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
      <MonitorHeader overview={overview} alertCount={alertCount} isLoading={isLoading} connectionError={error} />
      <AlertBanner alerts={bannerAlerts} />

      <TabBar activeTab={activeTab} onSwitch={switchTab} remainingSeconds={remainingSeconds}
        rotationSeconds={tabRotation} mediaBadge={mediaBadge} />

      {/* Infrastructure tab */}
      <main className="flex-1 grid gap-[14px] p-[14px_20px_18px] min-h-0"
        style={{ display: activeTab === 'infra' ? 'grid' : 'none', gridTemplateColumns: '1.25fr 1fr 0.95fr', gridTemplateRows: '1fr 1fr 1fr' }}>
        {/* Host cards — column 1, paginated */}
        <div style={{ gridColumn: 1, gridRow: '1 / span 3' }} className="flex flex-col gap-[10px] min-h-0 overflow-hidden">
          {visibleHosts.map((h) => (
            <div key={h.host.id} className="flex-1 min-h-0">
              <HostCard host={h} />
            </div>
          ))}
          {hosts.length > HOSTS_PER_PAGE && (
            <div className="flex items-center justify-center gap-1 py-1 flex-shrink-0">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setHostPage(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === hostPage ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Middle column: Solar + Docker */}
        <div className="flex flex-col gap-[14px] min-h-0" style={{ gridColumn: 2, gridRow: '1 / span 3' }}>
          {overview?.solar && <div className="flex-shrink-0"><SolarCard solar={overview.solar} /></div>}
          <div className="flex-1 min-h-0"><DockerCard docker={overview?.docker ?? emptyDocker} /></div>
        </div>

        {/* Alerts rail — column 3 */}
        <div style={{ gridColumn: 3, gridRow: '1 / span 3' }} className="min-h-0">
          <AlertsRail firing={overview?.alerts?.firing ?? []} recentlyResolved={overview?.alerts?.recentlyResolved ?? []}
            onAck={(id) => { ackAlert(id).catch(() => {}); }} />
        </div>
      </main>

      {/* Media & Downloads tab */}
      <main className="flex-1 grid gap-[14px] p-[14px_20px_18px] min-h-0"
        style={{ display: activeTab === 'media' ? 'grid' : 'none', gridTemplateColumns: '1.55fr 1fr', gridTemplateRows: '1.35fr 1fr' }}>
        {/* Active streams — spans both rows, scrollable */}
        <div style={{ gridRow: '1 / span 2' }} className="min-h-0 overflow-hidden">
          {overview?.media ? <StreamsCard media={overview.media} /> : (
            <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)] text-[13px]">No media servers configured</div>
          )}
        </div>

        {/* Usenet / Arr / OPNSense cards — scrollable */}
        <div className="flex flex-col gap-[14px] min-h-0 overflow-y-auto" style={{ gridRow: '1 / span 2' }}>
          {overview?.usenet && <UsenetCard usenet={overview.usenet} />}
          {overview?.arr && <ArrCard arr={overview.arr} />}
          {overview?.opnsense && <OpnsenseCard opnsense={overview.opnsense} />}
          {!overview?.usenet && !overview?.arr && !overview?.opnsense && (
            <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)] text-[13px]">No downloaders configured</div>
          )}
        </div>
      </main>
    </div>
  );
}

const emptyDocker = { status: 'ok' as const, total: 0, running: 0, healthy: 0, unhealthy: 0, restarting: 0, problems: [] };
