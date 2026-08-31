import type { CertificateEntry, CertificateSnapshot } from '../../types';
import { SourceDot } from './SourceDot';

interface CertificatesCardProps {
  certificates: CertificateSnapshot | null;
}

/** Max certificates shown in the network grid before collapsing into "+n more". */
const MAX_VISIBLE_CERTS = 4;

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
 * the surrounding cards' size and skin. Certs are sorted soonest-expiring
 * first and capped at MAX_VISIBLE_CERTS with a "+n more" overflow badge.
 */
export function CertificatesCard({ certificates }: CertificatesCardProps) {
  // Soonest-expiring first (negative = already expired = most urgent).
  // Entries with no expiry date (unreachable / errored) sink to the bottom.
  const sorted = [...(certificates?.items ?? [])].sort((a, b) => {
    if (a.daysLeft == null && b.daysLeft == null) return a.name.localeCompare(b.name);
    if (a.daysLeft == null) return 1;
    if (b.daysLeft == null) return -1;
    return a.daysLeft - b.daysLeft;
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
