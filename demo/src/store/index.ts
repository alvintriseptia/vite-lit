import { createStore, type StoreApi } from 'zustand/vanilla';
import { createCounterSlice, type CounterSlice } from './counter-slice.ts';
import { createTodoSlice, type TodoSlice } from './todo-slice.ts';

export type AppStore = CounterSlice & TodoSlice;

/**
 * Zustand + HMR Strategy:
 *
 * The challenge: zustand stores are module-level singletons. When Vite HMR
 * re-executes this module, a naive `createStore()` call would create a NEW
 * store, losing all state and breaking existing subscriptions.
 *
 * Solution: persist the STORE INSTANCE itself (not just state) in
 * `import.meta.hot.data`. This way:
 * - All existing subscribers stay connected to the same store object
 * - State is preserved because the store object is reused
 * - Slice action functions are hot-patched via setState(merged, replace)
 *
 * This handles 3 HMR scenarios:
 * 1. Edit zustand-element.ts → lit-hmr patches the component, store untouched
 * 2. Edit store/index.ts → this module re-runs, reuses store, re-applies slices
 * 3. Edit a slice file → bubbles here (self-accepting boundary), same as #2
 */

let store: StoreApi<AppStore>;

if (import.meta.hot?.data.store) {
  // HMR reload: reuse the existing store instance so subscribers stay connected
  store = import.meta.hot.data.store;

  // Re-apply slice creators to pick up any changes to action logic
  // while preserving the current data values
  const currentState = store.getState();
  const freshSlice = {
    ...createCounterSlice(store.setState, store.getState, store),
    ...createTodoSlice(store.setState, store.getState, store),
  };

  // Merge: keep data values from current state, replace functions with new versions
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(freshSlice)) {
    const freshVal = (freshSlice as Record<string, unknown>)[key];
    merged[key] =
      typeof freshVal === 'function'
        ? freshVal // new action function from updated slice
        : (currentState as unknown as Record<string, unknown>)[key] ?? freshVal; // preserve data
  }
  store.setState(merged as unknown as AppStore, true);

  console.log('[zustand-hmr] Reused store instance, patched actions. State:', store.getState());
} else {
  // First load: create a fresh store
  store = createStore<AppStore>()((...a) => ({
    ...createCounterSlice(...a),
    ...createTodoSlice(...a),
  }));
}

export { store };

if (import.meta.hot) {
  // Persist the store instance for the next HMR cycle
  import.meta.hot.data.store = store;

  // Self-accept: acts as HMR boundary for this module and its slice dependencies
  import.meta.hot.accept();
}
