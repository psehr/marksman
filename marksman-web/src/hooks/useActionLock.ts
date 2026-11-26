"use client";

import { useSyncExternalStore } from "react";

const locks = new Set<string>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
function notify() { for (const listener of listeners) listener(); }

/** One request per identity/bounty/action, including duplicate controls on detail pages. */
export function useActionLock(key: string) {
  const locked = useSyncExternalStore(subscribe, () => locks.has(key), () => false);
  return {
    locked,
    acquire() {
      if (locks.has(key)) return false;
      locks.add(key);
      notify();
      return true;
    },
    release() { locks.delete(key); notify(); },
  };
}
