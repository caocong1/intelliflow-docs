import { createSignal, onCleanup, onMount, Show } from "solid-js";

type BannerState = "hidden" | "offline" | "reconnected";

/**
 * Network status banner with auto-reconnect.
 * Shows amber banner when offline, polls /api/health with exponential backoff,
 * and shows green "reconnected" banner for 3s on recovery.
 */
export default function NetworkBanner() {
  const [bannerState, setBannerState] = createSignal<BannerState>("hidden");
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const MAX_RETRIES = 10;
  const BASE_DELAY = 3000;
  const MAX_DELAY = 30000;

  /** Pending operations queue — draft saves queued while offline */
  const pendingQueue: Array<() => Promise<void>> = [];

  async function checkHealth(): Promise<boolean> {
    try {
      const res = await fetch("/api/health", { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function flushQueue() {
    while (pendingQueue.length > 0) {
      const op = pendingQueue.shift();
      if (op) {
        try {
          await op();
        } catch {
          // Silent fail for queued operations
        }
      }
    }
  }

  function startReconnect() {
    if (retryCount >= MAX_RETRIES) return;

    const delay = Math.min(BASE_DELAY * 2 ** retryCount, MAX_DELAY);
    retryCount++;

    retryTimer = setTimeout(async () => {
      const online = await checkHealth();
      if (online) {
        handleOnline();
      } else {
        startReconnect();
      }
    }, delay);
  }

  function handleOffline() {
    retryCount = 0;
    setBannerState("offline");
    startReconnect();
  }

  function handleOnline() {
    clearTimeout(retryTimer);
    retryCount = 0;
    setBannerState("reconnected");
    flushQueue();
    hideTimer = setTimeout(() => setBannerState("hidden"), 3000);
  }

  onMount(() => {
    if (!navigator.onLine) {
      handleOffline();
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", () => {
      // Verify with health check before showing reconnected
      checkHealth().then((ok) => {
        if (ok) handleOnline();
      });
    });
  });

  onCleanup(() => {
    clearTimeout(retryTimer);
    clearTimeout(hideTimer);
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
  });

  /** Expose queue for external use */
  (NetworkBanner as any).queueOperation = (op: () => Promise<void>) => {
    if (bannerState() === "offline") {
      pendingQueue.push(op);
    } else {
      op().catch(() => {});
    }
  };

  return (
    <>
      <Show when={bannerState() === "offline"}>
        <div class="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium shadow-md">
          <div class="flex items-center justify-center gap-2">
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <title>reconnecting</title>
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>网络连接已断开，正在尝试重新连接...</span>
          </div>
        </div>
      </Show>
      <Show when={bannerState() === "reconnected"}>
        <div class="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white text-center py-2 px-4 text-sm font-medium shadow-md">
          <div class="flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>connected</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>已重新连接</span>
          </div>
        </div>
      </Show>
    </>
  );
}
