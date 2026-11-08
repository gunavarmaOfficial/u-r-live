import { useEffect } from 'react';

/**
 * Pauses CSS animations and glowing layers while the tab is hidden so background
 * tabs do not burn CPU, GPU or battery. Pair with the [data-document-hidden]
 * rules in index.css.
 */
export function useVisibility() {
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.documentHidden = document.hidden ? 'true' : 'false';
    };
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => document.removeEventListener('visibilitychange', apply);
  }, []);
}
