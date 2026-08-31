import type { CertificateEntry, CertificateSnapshot } from '../../types';
import { SourceDot } from './SourceDot';

interface CertificatesCardProps {
  certificates: CertificateSnapshot | null;
}

/** Max certificates shown in the network grid before collapsing into "+n more". */
const MAX_VISIBLE_CERTS = 4;

/**
 * Sort urgency for a certificate. Issues rise to the top so the visible rows
 * match the card's aggregate status (a `degraded` badge is explained by the
 * errored/expired certs shown first, instead of being hidden behind "+n more").
 * 0 = expired, 1 = unreachable/errored, 2 = critical (<=5d), 3 = warning (<=21d),
 * 4 = healthy. Within a tier, soonest-expiry bubbles up.
 */
function certUrgency(entry: CertificateEntry): number {
  if (entry.daysLeft == null) return entry.status === 'error' ? 1 : 3; // unreachable / no date
  if (entry.daysLeft < 0) return 0; // expired
  if (entry.daysLeft <= 5) return 2; // critical — under the 5-day alert window
  if (entry.daysLeft <= 21) return 3; // warning
  return 4; // healthy
}

/** Background status colour for a cert's dot, mirroring the alarm scale. */
function certDotColor(entry: CertificateEntry): string {
  if (entry.status === 'error') return 'var(--mon-text-faint)';
  if (entry.daysLeft == null) return 'var(--mon-text-faint)';
  if (entry.daysLeft < 0) return 'var(--mon-danger)';
  if (entry.daysLeft <= 5) return 'var(--mon-danger)';
  if (entry.daysLeft <= 21) return 'var(--mon-warn)';
  return 'var(--mon-ok)';
}

function daysLabel(entry: CertificateEntry): { text: string; color: string } {
  if (entry.status === 'error') return { text: 'Unreachable', color: 'var(--mon-text-faint)' };
  if (entry.daysLeft == null) return { text: '—', color: 'var(--mon-text-faint)' };
  if (entry.daysLeft < 0) return { text: 'EXPIRED', color: 'var(--mon-danger)' };
  const text = entry.daysLeft === 1 ? '1 day' : `${entry.daysLeft} days`;
  return { text, color: certDotColor(entry) };
}

/**
 * TLS certificate expiry card — renders inside the network grid as a
 * `net-v2-card` (WAN Uplink / WAN/ LAN Interfaces / Certificates) so it shares
 * the surrounding cards' size and skin. Certs are sorted issues-first (expired,
 * unreachable, critical, warning, then healthy — soonest-expiry within each
 * tier) and capped at MAX_VISIBLE_CERTS with a "+n more" overflow badge.
 */
export function CertificatesCard({ certificates }: CertificatesCardProps) {
  // Issues rise to the top (expired, unreachable, critical, warning), then
  // healthy certs soonest-to-expire. This keeps the visible rows consistent
  // with the aggregate badge — errored certs that mark the card "degraded"
  // surface first instead of hiding behind "+n more".
  const sorted = [...(certificates?.items ?? [])].sort((a, b) => {
    const ua = certUrgency(a);
    const ub = certUrgency(b);
    if (ua !== ub) return ua - ub;
    // Same tier: soonest-expiry first; null / errored by name.
    if (a.daysLeft != null && b.daysLeft != null) {
      if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    } else if (a.daysLeft != null) return -1;
    else if (b.daysLeft != null) return 1;
    return a.name.localeCompare(b.name);
  });

  const visible = sorted.slice(0, MAX_VISIBLE_CERTS);
  const more = sorted.length - visible.length;

  if (!certificates || sorted.length === 0) {
    return (
      <div className="net-v2-card">
        <div className="net-section-title">Certificates</div>
        <div className="text-[var(--mon-text-muted)] text-[11px] py-2">
          No certificates configured
        </div>
      </div>
    );
  }

  return (
    <div className="net-v2-card">
      <div className="net-section-title net-cert-title">
        Certificates
        <span className="net-cert-status">
          <SourceDot status={certificates.status} />
        </span>
      </div>

      <div className="net-ifaces-list">
        {visible.map((entry) => {
          const { text, color } = daysLabel(entry);
          return (
            <div className="net-cert-row" key={entry.id}>
              <span className="net-iface-name" title={`${entry.host}:${entry.port}`}>
                <span className="net-iface-dot" style={{ backgroundColor: certDotColor(entry) }} />
                <span>{entry.name || entry.host}</span>
              </span>
              <span className="net-cert-days" style={{ color, textTransform: entry.daysLeft != null && entry.daysLeft < 0 ? 'uppercase' : undefined }}>
                {text}
              </span>
            </div>
          );
        })}
      </div>

      {more > 0 && (
        <div className="net-talker-more">
          <span className="net-talker-more-badge">+ {more} more</span>
        </div>
      )}
    </div>
  );
}
