import { Bell, CheckCircle } from 'lucide-react';
import type { AlertInstance } from '../../types';

interface AlertsRailProps {
  firing: AlertInstance[];
  recentlyResolved: AlertInstance[];
  onAck: (id: string) => void;
}

const sevStyle: Record<string, string> = {
  critical: 'bg-[color-mix(in_srgb,var(--color-error)_18%,transparent)] text-[var(--color-error)]',
  warning: 'bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]',
  info: 'bg-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] text-[var(--color-primary)]',
  resolved: 'bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)]',
};

function ago(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

export function AlertsRail({ firing, recentlyResolved, onAck }: AlertsRailProps) {
  return (
    <section className="flex flex-col rounded-2xl border border-[var(--color-border)] p-[14px_16px] bg-[var(--color-surface)] min-h-0 overflow-hidden col-span-1 row-span-3">
      <div className="flex items-center gap-[9px] mb-[11px]">
        <Bell className="w-4 h-4 text-[var(--color-text-secondary)]" />
        <h2 className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">Alerts</h2>
        <span className="text-[11px] text-[var(--color-text-secondary)]">{firing.length} firing</span>
      </div>

      <div className="overflow-y-auto flex-1 -m-1 p-1 space-y-[6px]">
        <AlertSection label="Firing" alerts={firing} onAck={onAck} />
        <AlertSection label="Recently resolved" alerts={recentlyResolved} resolved />
      </div>
    </section>
  );
}

function AlertSection({ label, alerts, resolved, onAck }: {
  label: string;
  alerts: AlertInstance[];
  resolved?: boolean;
  onAck?: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.8px] text-[var(--color-text-secondary)] my-[6px]">
        {label}
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      {alerts.length === 0 ? (
        <div className={`rounded-lg border p-[9px_11px] bg-[var(--color-surface)] ${resolved ? 'border-[var(--color-success)] opacity-60' : 'border-[var(--color-success)]'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-[var(--color-success)]" />
            <span className="text-[12px] text-[var(--color-text-secondary)]">{resolved ? 'No recently resolved alerts' : 'No active alerts'}</span>
          </div>
        </div>
      ) : (
        alerts.map(a => (
          <div key={a.id} className={`rounded-lg border border-l-[3px] p-[9px_11px] bg-[var(--color-surface)] ${resolved ? 'border-l-[var(--color-success)] opacity-60' : a.severity === 'critical' ? 'border-l-[var(--color-error)]' : 'border-l-[var(--color-warning)]'}`}>
            <div className="flex items-center gap-[7px]">
              <span className={`text-[9.5px] font-extrabold tracking-[.6px] uppercase px-[6px] py-[2px] rounded ${sevStyle[a.severity] || sevStyle.warning}`}>
                {resolved ? 'resolved' : a.severity}
              </span>
              <span className="ml-auto text-[10px] text-[var(--color-text-secondary)]">{ago(a.since)}</span>
            </div>
            <div className="text-[12px] leading-snug mt-[5px]">{stripHtml(a.message)}</div>
            {a.state === 'firing' && onAck && !a.acked && (
              <button
                onClick={() => onAck(a.id)}
                className="mt-[7px] text-[11px] font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border)] bg-transparent rounded-md px-[10px] py-[3px] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-secondary)] cursor-pointer"
              >
                Acknowledge
              </button>
            )}
          </div>
        ))
      )}
    </>
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}
