import { createSignal, For, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../../api/client";

interface Notification {
  id: string;
  userId: string;
  type: "generation_completed" | "generation_failed";
  title: string;
  message: string | null;
  documentId: string | null;
  projectId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.max(0, Math.floor((now - date) / 1000));

  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

export default function NotificationDrawer(props: NotificationDrawerProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = createSignal<Notification[]>([]);
  const [loading, setLoading] = createSignal(false);

  async function fetchList() {
    setLoading(true);
    try {
      const data = await getNotifications({ limit: 50 });
      setNotifications(data.notifications as Notification[]);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  // Fetch on open
  const prevOpen = { value: false };
  onMount(() => {
    if (props.isOpen) fetchList();
  });

  // Re-fetch when drawer opens (reactive via getter)
  // We use a simple check pattern since props.isOpen is a getter
  function checkAndFetch() {
    if (props.isOpen && !prevOpen.value) {
      fetchList();
    }
    prevOpen.value = props.isOpen;
  }

  // Call checkAndFetch whenever the component re-renders
  // SolidJS will track props.isOpen reactively in the JSX below

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Silent fail
    }
  }

  async function handleClickNotification(notification: Notification) {
    try {
      if (!notification.isRead) {
        await markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
        );
      }
      if (notification.projectId && notification.documentId) {
        navigate(
          `/projects/${notification.projectId}/documents/${notification.documentId}/workspace`,
        );
      }
      props.onClose();
    } catch {
      // Silent fail
    }
  }

  return (
    <Show when={props.isOpen}>
      {/* Track open state for re-fetching */}
      {(() => {
        checkAndFetch();
        return null;
      })()}
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-[90] bg-black/30 transition-opacity"
        onClick={() => props.onClose()}
      />
      {/* Drawer panel */}
      <div class="fixed top-0 right-0 z-[91] h-full w-[350px] bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 class="text-base font-semibold text-gray-900">通知</h2>
          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllRead}
              class="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium"
            >
              全部标记已读
            </button>
            <button
              type="button"
              onClick={() => props.onClose()}
              class="p-1 text-gray-400 hover:text-gray-600 cursor-pointer rounded-md hover:bg-gray-100"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <title>关闭</title>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div class="flex-1 overflow-y-auto">
          <Show when={loading()}>
            <div class="flex items-center justify-center py-12 text-sm text-gray-400">
              加载中...
            </div>
          </Show>
          <Show when={!loading() && notifications().length === 0}>
            <div class="flex items-center justify-center py-12 text-sm text-gray-400">
              暂无通知
            </div>
          </Show>
          <Show when={!loading() && notifications().length > 0}>
            <ul class="divide-y divide-gray-100">
              <For each={notifications()}>
                {(notification) => (
                  <li
                    class={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                      !notification.isRead ? "bg-indigo-50/50 border-l-2 border-l-indigo-500" : "border-l-2 border-l-transparent"
                    }`}
                    onClick={() => handleClickNotification(notification)}
                  >
                    {/* Type icon */}
                    <div class="flex-shrink-0 mt-0.5">
                      {notification.type === "generation_completed" ? (
                        <div class="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                          <svg class="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            <title>完成</title>
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div class="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
                          <svg class="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            <title>失败</title>
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* Content */}
                    <div class="min-w-0 flex-1">
                      <p class={`text-sm ${!notification.isRead ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                        {notification.title}
                      </p>
                      <Show when={notification.message}>
                        <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      </Show>
                      <p class="text-xs text-gray-400 mt-1">{relativeTime(notification.createdAt)}</p>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>
    </Show>
  );
}
