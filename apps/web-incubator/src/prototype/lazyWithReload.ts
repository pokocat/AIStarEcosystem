import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'lazy-module-reload-at';
const RELOAD_WINDOW_MS = 10_000;

/**
 * Reload once when a lazily imported module can't be fetched. This happens when the Vite dev
 * server re-optimises dependencies (or a new deployment replaces chunks) while a tab still holds
 * the old module URLs. A timestamp guard prevents reload loops if the failure is persistent.
 */
const reloadOnce = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: still try a single reload for this page view.
  }
  window.location.reload();
  return true;
};

export const lazyWithReload = <T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) =>
  lazy(async () => {
    try {
      const module = await loader();
      try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ }
      return module;
    } catch (error) {
      // Keep Suspense pending while the page reloads instead of flashing an error.
      if (reloadOnce()) return new Promise<never>(() => {});
      throw error;
    }
  });

// Production builds: Vite emits this event when a preloaded chunk fails to load.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', event => {
    if (reloadOnce()) event.preventDefault();
  });
}
