import { useEffect, useRef } from 'react';

export function useFormDraft<T>(key: string, value: T, enabled: boolean, restore: (draft: T) => void) {
  const restored = useRef(false);
  useEffect(() => {
    if (!enabled || restored.current) return;
    const saved = localStorage.getItem(key);
    if (saved) {
      try { restore(JSON.parse(saved)); } catch { localStorage.removeItem(key); }
    }
    restored.current = true;
  }, [enabled, key, restore]);
  useEffect(() => {
    if (!enabled || !restored.current) return;
    localStorage.setItem(key, JSON.stringify(value));
  }, [enabled, key, value]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (enabled) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [enabled]);
  return () => localStorage.removeItem(key);
}
