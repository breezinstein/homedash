import type { MonitorOverview } from '../types';

/** Something the monitor can see is wrong that no alert rule fired for. */
export interface MonitorIssue {
  id: string;
  title: string;
  detail?: string;
  tone: 'warning' | 'danger';
}

const SOURCE_LABEL = {
  solar: 'Solar Assistant',
  media: 'Media server',
  usenet: 'Downloader',
  arr: 'Sonarr / Radarr',
  seerr: 'Request service',
  opnsense: 'OPNsense',
  ntopng: 'ntopng',
  homeassistant: 'Home Assistant',
  certificates: 'Certificate checks',
} as const;

const APP_NAME: Record<string, string> = { sonarr: 'Sonarr', radarr: 'Radarr', sabnzbd: 'SABnzbd', nzbget: 'NZBGet' };
const appName = (name: string, type: string) => name?.trim() || APP_NAME[type] || type;

/**
 * Everything that makes the server call the monitor degraded, plus Sonarr and
 * Radarr health warnings, so the alerts list explains the status chip even when
 * no rule has fired.
 */
export function collectIssues(o: MonitorOverview | null): MonitorIssue[] {
  if (!o) return [];
  const issues: MonitorIssue[] = [];

  for (const h of o.hosts) {
    if (h.status === 'down') {
      issues.push({ id: `host:${h.host.id}`, title: `${h.host.name} is down`, detail: h.error, tone: 'danger' });
    }
  }

  for (const c of o.docker?.problems ?? []) {
    const what = c.health === 'unhealthy' ? 'is unhealthy' : c.state === 'restarting' ? 'keeps restarting' : `is ${c.state}`;
    issues.push({ id: `docker:${c.name}`, title: `${c.name} ${what}`, detail: c.image, tone: 'warning' });
  }

  for (const key of Object.keys(SOURCE_LABEL) as (keyof typeof SOURCE_LABEL)[]) {
    const src = o[key] as { status?: string; error?: string } | null;
    if (src?.status === 'down') {
      issues.push({ id: `source:${key}`, title: `${SOURCE_LABEL[key]} isn't answering`, detail: src.error, tone: 'danger' });
    }
  }

  for (const inst of o.usenet?.instances ?? []) {
    if (inst.status === 'down' && o.usenet?.status !== 'down') {
      issues.push({ id: `usenet:${inst.type}:${inst.name}`, title: `${appName(inst.name, inst.type)} isn't answering`, detail: inst.error, tone: 'danger' });
    }
  }

  for (const inst of o.arr?.instances ?? []) {
    const name = appName(inst.name, inst.type);
    if (inst.status === 'down' && o.arr?.status !== 'down') {
      issues.push({ id: `arr:${inst.type}:${inst.name}`, title: `${name} isn't answering`, detail: inst.error, tone: 'danger' });
    }
    inst.healthWarnings.forEach((w, i) => {
      issues.push({ id: `arr:${inst.type}:${inst.name}:health:${i}`, title: `${name} health warning`, detail: w, tone: 'warning' });
    });
  }

  return issues;
}
