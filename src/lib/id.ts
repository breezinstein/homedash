/**
 * Client-side unique id. Prefers crypto.randomUUID (available in secure
 * contexts); falls back to a time+random string for plain-HTTP homelab
 * setups. Used for clips, servers, inverters, toasts and alert rules.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
