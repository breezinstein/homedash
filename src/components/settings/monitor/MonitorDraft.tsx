import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { useDashboard } from '../../../context/DashboardContext';
import type { MonitoringConfig } from '../../../types';
import { setNavGuard } from '../../../lib/navGuard';
import { Button, useConfirm, useToast } from '../../ui';

export function defaultMonitoring(): MonitoringConfig {
  return {
    enabled: false,
    pollIntervalSeconds: 10,
    solar: { enabled: false },
    docker: { enabled: true },
    media: [],
    usenet: [],
    arr: [],
    seerr: [],
    opnsense: [],
    ntopng: [],
    homeassistant: [],
    certificates: [],
    ui: { tabRotationSeconds: 15 },
    alerts: [],
  };
}

type ListKey = 'media' | 'usenet' | 'arr' | 'seerr' | 'opnsense' | 'ntopng' | 'homeassistant' | 'certificates';

interface MonitorDraftValue {
  mon: MonitoringConfig;
  update: (patch: Partial<MonitoringConfig>) => void;
  setList: <K extends ListKey>(key: K, list: MonitoringConfig[K]) => void;
  dirty: boolean;
  save: () => void;
  discard: () => void;
}

const MonitorDraftContext = createContext<MonitorDraftValue | null>(null);

export function useMonitorDraft(): MonitorDraftValue {
  const ctx = useContext(MonitorDraftContext);
  if (!ctx) throw new Error('useMonitorDraft needs MonitorDraftProvider');
  return ctx;
}

/**
 * Monitor sections stage their edits and save together. A save restarts the
 * server's poller, so a half-typed URL must not go live on every keystroke the
 * way dashboard settings do.
 */
export function MonitorDraftProvider({ children }: { children: ReactNode }) {
  const { config, setConfig } = useDashboard();
  const confirm = useConfirm();
  const toast = useToast();
  const base = useMemo(() => ({ ...defaultMonitoring(), ...(config.monitoring ?? {}) }), [config.monitoring]);
  const [draft, setDraft] = useState<MonitoringConfig | null>(null);
  const mon = draft ?? base;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(base);

  const update = useCallback((patch: Partial<MonitoringConfig>) => {
    setDraft((prev) => ({ ...(prev ?? base), ...patch }));
  }, [base]);

  const setList = useCallback(<K extends ListKey>(key: K, list: MonitoringConfig[K]) => {
    update({ [key]: list } as Partial<MonitoringConfig>);
  }, [update]);

  const latest = useRef({ config, draft, dirty });
  latest.current = { config, draft, dirty };

  const save = useCallback(() => {
    const { config: cfg, draft: d, dirty: isDirty } = latest.current;
    if (!d || !isDirty) return;
    const { glancesHosts: _legacy, ...monitoring } = d;
    void _legacy;
    setConfig({ ...cfg, monitoring: monitoring as MonitoringConfig });
    setDraft(null);
    toast.success('Monitor settings saved');
  }, [setConfig, toast]);

  const discard = useCallback(() => setDraft(null), []);

  useEffect(() => {
    if (!dirty) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    setNavGuard(async () => {
      if (!latest.current.dirty) return true;
      const leave = await confirm({
        title: 'Discard monitor changes?',
        message: 'You changed monitor settings without saving. Leaving now drops those changes.',
        confirmLabel: 'Discard changes',
        tone: 'danger',
      });
      if (leave) setDraft(null);
      return leave;
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
      setNavGuard(null);
    };
  }, [dirty, save, confirm]);

  const value = useMemo(() => ({ mon, update, setList, dirty, save, discard }), [mon, update, setList, dirty, save, discard]);
  return <MonitorDraftContext.Provider value={value}>{children}</MonitorDraftContext.Provider>;
}

/** The save row at the bottom of every monitor section. */
export function MonitorSaveBar() {
  const { dirty, save, discard } = useMonitorDraft();
  return (
    <div className="ui-savebar" data-dirty={dirty || undefined}>
      {dirty ? (
        <span className="ui-chip" data-tone="warning">Unsaved changes</span>
      ) : (
        <span className="text-xs text-[var(--color-text-secondary)]">Monitor settings save when you press Save.</span>
      )}
      <kbd className="ui-kbd hidden sm:inline-flex">Ctrl S</kbd>
      <span className="flex-1" />
      <Button variant="ghost" size="sm" onClick={discard} disabled={!dirty}>
        <Undo2 className="size-3.5" aria-hidden="true" /> Discard
      </Button>
      <Button variant="primary" size="sm" onClick={save} disabled={!dirty}>
        <Save className="size-3.5" aria-hidden="true" /> Save changes
      </Button>
    </div>
  );
}
