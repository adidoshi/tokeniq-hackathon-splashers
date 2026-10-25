import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false during SSR and the hydration render, true afterwards. Live widgets read a query cache that the
 * WebSocket may fill before a page segment hydrates; gating them on this keeps the first client render
 * identical to the server HTML (no hydration mismatch), with no setState-in-effect.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
