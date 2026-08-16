/**
 * Shared formatting helpers for the /monitor page. Centralising these here
 * keeps the kiosk cards consistent (a throughput number reads the same way in
 * the network panel and the top cards) and avoids copy-paste drift between
 * components that previously each declared their own private copy.
 */

/** Format a byte-rate (bytes/sec) as bits/sec, e.g. "12.5 Mbps". */
export function formatBitRate(bytesPerSec: number | null): string {
  if (bytesPerSec == null || !Number.isFinite(bytesPerSec)) return '—';
  const bits = bytesPerSec * 8; // bytes/sec → bits/sec
  if (bits >= 1e9) return `${(bits / 1e9).toFixed(1)} Gbps`;
  if (bits >= 1e6) return `${(bits / 1e6).toFixed(1)} Mbps`;
  if (bits >= 1e3) return `${(bits / 1e3).toFixed(1)} Kbps`;
  return `${Math.round(bits)} bps`;
}

/** Format a byte-rate (bytes/sec) as bytes/sec, e.g. "12.5 MB/s". */
export function formatByteRate(bytesPerSec: number | null, empty = '—'): string {
  if (bytesPerSec == null || !Number.isFinite(bytesPerSec)) return empty;
  if (bytesPerSec >= 1e9) return `${(bytesPerSec / 1e9).toFixed(1)} GB/s`;
  if (bytesPerSec >= 1e6) return `${(bytesPerSec / 1e6).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1e3) return `${(bytesPerSec / 1e3).toFixed(1)} KB/s`;
  return `${Math.round(bytesPerSec)} B/s`;
}

/** Format a byte count in SI units (base 1000), e.g. "1.5 GB". */
export function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** Format a byte count in binary units (base 1024), e.g. "1.5 GB". */
export function formatBytesBinary(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Format a size given in megabytes, e.g. "1.5 GB" / "800 MB". */
export function formatMegabytes(mb: number | null): string {
  if (mb == null || !Number.isFinite(mb)) return '';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

/**
 * Format an elapsed duration in seconds as "Xh Ym" / "Xd Yh". With
 * `compact` the seconds component is dropped for sub-minute values (used by
 * the talker window label); otherwise "Xm Ys" is shown for sub-hour values.
 */
export function formatDuration(totalSeconds: number, opts: { compact?: boolean } = {}): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return opts.compact ? `${mins}m` : `${mins}m ${secs % 60}s`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/** Compact window label for the DATA counter, e.g. "5d 13h" or "7m". */
export function formatWindow(firstSeen: number | null): string | null {
  if (firstSeen == null) return null;
  return formatDuration(Date.now() / 1000 - firstSeen, { compact: true });
}

/** Compact relative time ("5m"), rounding to the largest unit. */
export function formatAgo(timestampMs: number): string {
  const diff = Math.round((Date.now() - timestampMs) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

/** Solar Assistant convention: positive battery power = charging. */
export function batteryCharging(powerW: number | null): boolean {
  return powerW != null && powerW > 5;
}

/** Dynamic label for the battery time readout: "Time to full" while charging, "Time to depleted" otherwise. */
export function runtimeLabel(charging: boolean): string {
  return charging ? 'Time to full' : 'Time to depleted';
}

/** Solar "battery runtime" label plus its warning colour. */
export function formatRuntime(mins: number | null): { text: string; color: string } {
  if (mins == null || !Number.isFinite(mins)) return { text: '—', color: 'var(--mon-text-faint)' };
  const total = Math.max(0, Math.round(mins));
  if (total < 1) return { text: '<1m', color: 'var(--mon-danger)' };
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  let text: string;
  if (d > 0) text = `${d}d ${h}h`;
  else if (h > 0) text = `${h}h ${m}m`;
  else text = `${m}m`;
  const color = total < 120 ? 'var(--mon-danger)' : total < 240 ? 'var(--mon-warn)' : 'var(--mon-ok)';
  return { text, color };
}

/** Download ETA from seconds, e.g. "2h 14m left". */
export function formatEta(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return '<1m left';
}

/** Parse Sonarr/Radarr "HH:MM:SS" timeleft into a short human label. */
export function parseEtaLabel(timeLeft: string | null): string | null {
  if (!timeLeft) return null;
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(timeLeft.trim());
  if (!m) return timeLeft; // already a custom string
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const s = Number(m[3]);
  if (h > 0) return `${h}h ${min}m`;
  if (min > 0) return `${min}m ${s}s`;
  return s > 0 ? `${s}s` : null;
}

/** Strip HTML tags from a message body for a safe single-line display. */
export function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}
