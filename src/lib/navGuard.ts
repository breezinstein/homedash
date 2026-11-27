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
