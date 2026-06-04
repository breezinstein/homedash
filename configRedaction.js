// Public config projection.
//
// Anonymous (unauthenticated) viewers need enough config to render the
// launcher and theme, but must NOT receive secrets or admin-only data.
// Centralised here so every read path uses the same rules.

const PRIVATE_TOP_LEVEL = ['notifications', 'servers', 'clips'];
const PRIVATE_METADATA = ['restoredFrom', 'restoredAt'];

// Whitelist of `settings` keys exposed publicly. Anything else stays hidden
// even if added later.
const PUBLIC_SETTINGS_KEYS = ['timezone', 'customCSS', 'autoSync', 'syncInterval'];

export function redactConfigForPublic(config) {
  if (!config || typeof config !== 'object') return config;

  const out = { ...config };

  for (const key of PRIVATE_TOP_LEVEL) {
    if (key in out) delete out[key];
  }

  if (out.metadata && typeof out.metadata === 'object') {
    const meta = { ...out.metadata };
    for (const key of PRIVATE_METADATA) delete meta[key];
    out.metadata = meta;
  }

  if (out.settings && typeof out.settings === 'object') {
    const filtered = {};
    for (const key of PUBLIC_SETTINGS_KEYS) {
      if (key in out.settings) filtered[key] = out.settings[key];
    }
    out.settings = filtered;
  }

  return out;
}

// Merge an incoming PUT body with the on-disk config so that an admin who
// loaded a redacted config from a previously-anonymous browser, then logged
// in and saved, doesn't accidentally drop private sections that weren't in
// their in-memory copy.
//
// Rule: for every PRIVATE_TOP_LEVEL key, if the incoming body omits it but
// the on-disk config has it, preserve the on-disk value.
export function mergePrivateSections(incoming, existing) {
  if (!existing || typeof existing !== 'object') return incoming;
  if (!incoming || typeof incoming !== 'object') return incoming;
  const merged = { ...incoming };
  for (const key of PRIVATE_TOP_LEVEL) {
    if (!(key in merged) && key in existing) {
      merged[key] = existing[key];
    }
  }
  return merged;
}
