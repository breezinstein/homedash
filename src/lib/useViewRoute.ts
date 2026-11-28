import { useCallback, useEffect, useRef, useState } from 'react';
import { formatRoute, parseRoute, type View } from './route';
import { canLeave, guardPopState } from './navGuard';

interface Options {
  /** False for a view the person can't open yet (signed out on an admin view). */
  canOpen: (view: View) => boolean;
  onBlocked: (view: View) => void;
}

/**
 * The current view and settings section, kept in step with the URL. Every way
 * of leaving (a click, Back, Forward) asks the navigation guard first.
 */
export function useViewRoute({ canOpen, onBlocked }: Options) {
  const [initial] = useState(() => parseRoute(window.location.pathname));
  const [view, setView] = useState<View>(initial.view);
  const [section, setSection] = useState<string | undefined>(initial.section);
  // What the page shows right now, including a section picked inside Settings,
  // and the path to put back when a guard keeps the person here.
  const current = useRef({ view: initial.view, section: initial.section, path: window.location.pathname });

  const commit = useCallback((next: View, nextSection: string | undefined, mode: 'push' | 'replace' | 'none') => {
    const path = formatRoute({ view: next, section: next === 'settings' ? nextSection : undefined }, initial.base);
    if (mode === 'push' && path !== window.location.pathname) window.history.pushState(null, '', path);
    if (mode === 'replace' && path !== window.location.pathname) window.history.replaceState(null, '', path);
    current.current = { view: next, section: nextSection, path: mode === 'none' ? window.location.pathname : path };
    setView(next);
    setSection(next === 'settings' ? nextSection : undefined);
  }, [initial.base]);

  const navigate = useCallback(async (next: View, nextSection?: string) => {
    if (!canOpen(next)) {
      onBlocked(next);
      return false;
    }
    const here = current.current;
    // Choosing the view that's already open (Settings while in Settings) is not a move.
    if (next === here.view && (nextSection === undefined || nextSection === here.section)) return true;
    if (!(await canLeave())) return false;
    commit(next, nextSection, 'push');
    window.scrollTo?.({ top: 0 });
    return true;
  }, [canOpen, onBlocked, commit]);

  /** Jump without asking, for sign-out and expired sessions. */
  const reset = useCallback((next: View) => commit(next, undefined, 'replace'), [commit]);

  /** A section picked inside Settings: the URL follows without remounting the view. */
  const showSection = useCallback((nextSection: string) => {
    const path = formatRoute({ view: 'settings', section: nextSection }, initial.base);
    if (path !== window.location.pathname) window.history.replaceState(null, '', path);
    current.current = { view: 'settings', section: nextSection, path };
  }, [initial.base]);

  useEffect(() => {
    const onPop = () => {
      const target = window.location.pathname;
      void guardPopState(
        current.current.path,
        () => {
          const route = parseRoute(target);
          commit(route.view, route.section, 'none');
        },
        (stay) => window.history.pushState(null, '', stay),
      );
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [commit]);

  return { view, section, navigate, reset, showSection, initialView: initial.view };
}
