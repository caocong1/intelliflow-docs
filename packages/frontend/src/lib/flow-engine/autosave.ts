import { createSignal } from "solid-js";
import type { FlowSnapshot } from "./undo-redo";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave with queue pattern.
 * If a save is in-flight and new data arrives, queues it.
 * When the in-flight save completes, fires the queued save with the latest data.
 */
export function createAutosave(
  saveFn: (snapshot: FlowSnapshot) => Promise<void>,
  delay = 1500,
) {
  const [status, setStatus] = createSignal<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = createSignal<Date | null>(null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight = false;
  let queued: FlowSnapshot | null = null;

  async function doSave(snapshot: FlowSnapshot) {
    inflight = true;
    setStatus("saving");
    try {
      await saveFn(snapshot);
      setStatus("saved");
      setLastSavedAt(new Date());
    } catch {
      setStatus("error");
    } finally {
      inflight = false;
      // If data was queued while saving, fire another save
      if (queued) {
        const next = queued;
        queued = null;
        doSave(next);
      }
    }
  }

  function trigger(snapshot: FlowSnapshot) {
    if (timer) clearTimeout(timer);

    if (inflight) {
      // Queue latest data; will fire after current save completes
      queued = snapshot;
      return;
    }

    timer = setTimeout(() => {
      timer = null;
      doSave(snapshot);
    }, delay);
  }

  /** Force an immediate save (skip debounce). Used by manual save button. */
  function flush(snapshot: FlowSnapshot) {
    if (timer) clearTimeout(timer);
    if (inflight) {
      queued = snapshot;
      return;
    }
    doSave(snapshot);
  }

  function dispose() {
    if (timer) clearTimeout(timer);
  }

  return { trigger, flush, status, lastSavedAt, dispose };
}
