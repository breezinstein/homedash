// A view with unsaved work (the monitor settings draft) registers a check here;
// App asks it before switching views so a click in the sidebar can't drop edits.
type Guard = () => Promise<boolean>;

let guard: Guard | null = null;

export function setNavGuard(next: Guard | null) {
  guard = next;
}

export async function canLeave(): Promise<boolean> {
  return guard ? guard() : true;
}

/**
 * Back and Forward change the URL before the app hears about it. Ask the guard
 * first; if the person stays, put the page's own path back so the URL and the
 * view agree again.
 */
export async function guardPopState(
  stayPath: string,
  apply: () => void,
  restore: (path: string) => void,
): Promise<boolean> {
  if (await canLeave()) {
    apply();
    return true;
  }
  restore(stayPath);
  return false;
}
