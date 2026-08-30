import { Lock, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { CertificateEntry, CertificateSnapshot } from '../../types';
import { SourceDot } from './SourceDot';

interface CertificatesCardProps {
  certificates: CertificateSnapshot | null;
}

/** Colour for a days-left countdown, mirroring the alert severity scale. */
function daysColor(daysLeft: number | null): string {
  if (daysLeft == null) return 'var(--mon-text-faint)';
  if (daysLeft < 0) return 'var(--mon-danger)';
  if (daysLeft <= 5) return 'var(--mon-danger)';
  if (daysLeft <= 21) return 'var(--mon-warn)';
  return 'var(--mon-ok)';
}

function daysLabel(entry: CertificateEntry): { text: string; color: string } {
  if (entry.status === 'error') return { text: 'Unreachable', color: 'var(--mon-text-faint)' };
  if (entry.daysLeft == null) return { text: '—', color: 'var(--mon-text-faint)' };
  if (entry.daysLeft < 0) return { text: 'EXPIRED', color: 'var(--mon-danger)' };
  const text = entry.daysLeft === 1 ? '1 day left' : `${entry.daysLeft} days left`;
  return { text, color: daysColor(entry.daysLeft) };
}

/** Card showing every configured TLS certificate's days-to-expiry. */
export function CertificatesCard({ certificates }: CertificatesCardProps) {
  const items = certificates?.items ?? [];

  // Not configured — show an inert placeholder (mirrors the other top cards).
  if (!certificates || items.length === 0) {
    return (
      <section className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="card-icon card-icon-green">
              <Lock className="w-4 h-4" />
            </span>
            <div className="title-group">
              <span className="title">Certificates</span>
              <span className="subtitle">TLS Expiry</span>
            </div>
          </div>
          <span className="status-ok" style={{ opacity: 0.4 }}>offline</span>
        </div>
        <div
          className="flex items-center justify-center text-[var(--mon-text-muted)] text-[12px]"
          style={{ height: 100 }}
        >
          No certificates configured
        </div>
      </section>
    );
  }

  const anyError = items.some((c) => c.status === 'error');

  return (
    <section className="card">
      <div className="card-header">
        <div className="card-title-row">
          <span className={`card-icon ${anyError ? 'card-icon-orange' : 'card-icon-green'}`}>
            {anyError ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </span>
          <div className="title-group">
            <span className="title">Certificates</span>
            <span className="subtitle">TLS Expiry</span>
          </div>
        </div>
        <SourceDot status={certificates.status} />
      </div>

      <div className="summary-body">
        <div className="summary-list" style={{ gap: 8 }}>
          {items.map((entry) => {
            const { text, color } = daysLabel(entry);
            return (
              <div key={entry.id} className="summary-row">
                <span className="summary-row-key" title={`${entry.host}:${entry.port}`}>
                  <span className="summary-row-icon">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                  {entry.name || entry.host}
                </span>
                <span
                  className="summary-row-value"
                  style={{ color, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  {text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
