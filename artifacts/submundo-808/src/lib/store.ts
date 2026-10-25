import { useCallback, useSyncExternalStore } from 'react';

const PREFIX = 'sm808:';
const cache = new Map<string, unknown>();
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

export function useLocal<T>(key: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const k = PREFIX + key;
  const get = () => {
    if (!cache.has(k)) {
      try {
        const raw = localStorage.getItem(k);
        cache.set(k, raw ? JSON.parse(raw) : init);
      } catch {
        cache.set(k, init);
      }
    }
    return cache.get(k) as T;
  };
  const value = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    get,
  );
  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      const prev = cache.get(k) as T;
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      cache.set(k, next);
      try {
        localStorage.setItem(k, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      notify();
    },
    [k],
  );
  return [value, set];
}

export function resetDemo() {
  try {
    Object.keys(localStorage)
      .filter((x) => x.startsWith(PREFIX))
      .forEach((x) => localStorage.removeItem(x));
  } catch {
    /* ignore */
  }
  cache.clear();
  notify();
}

export type FriendStatus = 'none' | 'pending' | 'incoming' | 'friend';
export type FriendState = Record<string, { status: FriendStatus; share: boolean }>;

export const INITIAL_FRIENDS: FriendState = {
  p3: { status: 'friend', share: true },
  p5: { status: 'friend', share: true },
  p6: { status: 'friend', share: false },
  p9: { status: 'incoming', share: false },
  p10: { status: 'incoming', share: false },
};

export const DEFAULT_SETTINGS = {
  nome: 'Ravena Duarte',
  notificacoes: true,
  reduzirMovimento: false,
  altoContraste: false,
  compartilharGeral: true,
  unidade: 'metros',
};
export type Settings = typeof DEFAULT_SETTINGS;

export const asset = (n: string) => `${import.meta.env.BASE_URL}img/${n}`;
