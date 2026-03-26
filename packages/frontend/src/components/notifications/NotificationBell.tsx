import { createSignal, onCleanup, onMount } from "solid-js";
import { Show } from "solid-js";
import { getUnreadCount } from "../../api/client";

const NOTIFY_POLL_INTERVAL = 15;

interface NotificationBellProps {
  onOpen: () => void;
}

export default function NotificationBell(props: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = createSignal(0);

  async function fetchCount() {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silent fail — polling will retry
    }
  }

  onMount(() => {
    fetchCount();
  });

  const pollTimer = setInterval(() => {
    fetchCount();
  }, NOTIFY_POLL_INTERVAL * 1000);

  onCleanup(() => clearInterval(pollTimer));

  return (
    <button
      type="button"
      onClick={() => props.onOpen()}
      class="relative p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
      title="通知"
    >
      <svg
        class="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <title>通知</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      <Show when={unreadCount() > 0}>
        <span class="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
          {unreadCount() > 99 ? "99+" : unreadCount()}
        </span>
      </Show>
    </button>
  );
}
