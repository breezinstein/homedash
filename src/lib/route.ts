export type View =
  | 'dashboard'
  | 'monitor'
  | 'files'
  | 'stats'
  | 'inverter'
  | 'clipboard'
  | 'notifications'
  | 'settings';

export interface Route {
  view: View;
  /** Settings section key, only for the settings view. */
  section?: string;
}

const VIEWS: View[] = ['monitor', 'files', 'stats', 'inverter', 'clipboard', 'notifications', 'settings'];

function isView(segment: string | undefined): segment is View {
  return !!segment && (VIEWS as string[]).includes(segment);
}

export interface ParsedRoute extends Route {
  /** Path prefix in front of the view, so the app can live under a sub-path. */
  base: string;
}

/** Read the view from a pathname: `/monitor`, `/settings/monitor-hosts`, `/proxy/homedash/files`. */
export function parseRoute(pathname: string): ParsedRoute {
  const segments = pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  const last = segments[segments.length - 1];
  const prev = segments[segments.length - 2];
  const baseOf = (n: number) => {
    const head = segments.slice(0, segments.length - n);
    return head.length ? `/${head.join('/')}` : '';
  };
  if (prev === 'settings' && last && !isView(last)) {
    return { view: 'settings', section: last, base: baseOf(2) };
  }
  if (isView(last)) return { view: last, base: baseOf(1) };
  return { view: 'dashboard', base: segments.length ? `/${segments.join('/')}` : '' };
}

export function formatRoute(route: Route, base = ''): string {
  if (route.view === 'dashboard') return `${base}/`;
  if (route.view === 'settings' && route.section) {
    return `${base}/settings/${encodeURIComponent(route.section)}`;
  }
  return `${base}/${route.view}`;
}
