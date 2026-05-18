import { useEffect } from 'react';

let openCount = 0;

/**
 * Lock body scroll while a modal is open. Stacks correctly when multiple modals
 * are mounted (e.g. SettingsModal opens BackupManager).
 */
export function useBodyScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    openCount += 1;
    document.body.classList.add('modal-open');
    return () => {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) {
        document.body.classList.remove('modal-open');
      }
    };
  }, [active]);
}
