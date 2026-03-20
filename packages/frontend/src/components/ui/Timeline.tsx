import { For, createSignal } from "solid-js";

export type TimelineItem = {
  id: string;
  label: string;
  sublabel?: string;
  timestamp: string;
  isActive?: boolean;
};

type TimelineProps = {
  items: TimelineItem[];
  onItemClick?: (id: string) => void;
  selectedId?: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

export default function Timeline(props: TimelineProps) {
  return (
    <div class="relative">
      <For each={props.items}>
        {(item, index) => {
          const isSelected = () => props.selectedId === item.id;
          const isLast = () => index() === props.items.length - 1;

          return (
            <div
              class="relative flex items-start gap-3 pb-6 cursor-pointer group"
              onClick={() => props.onItemClick?.(item.id)}
            >
              {/* Vertical line */}
              {!isLast() && (
                <div class="absolute left-[5px] top-4 bottom-0 w-0.5 bg-indigo-200" />
              )}

              {/* Circle node */}
              <div
                class={`relative z-10 mt-1 w-3 h-3 rounded-full border-2 flex-shrink-0 transition-colors ${
                  isSelected()
                    ? "bg-indigo-600 border-indigo-600"
                    : "bg-white border-indigo-300 group-hover:border-indigo-500"
                }`}
              />

              {/* Content */}
              <div class="flex-1 min-w-0">
                <p
                  class={`text-sm font-medium truncate ${
                    isSelected() ? "text-indigo-700" : "text-gray-800"
                  }`}
                >
                  {item.label}
                </p>
                {item.sublabel && (
                  <p class="text-xs text-gray-500 mt-0.5 truncate">{item.sublabel}</p>
                )}
                <p class="text-xs text-gray-400 mt-0.5">{formatTime(item.timestamp)}</p>
              </div>
            </div>
          );
        }}
      </For>

      {props.items.length === 0 && (
        <p class="text-sm text-gray-400 text-center py-8">暂无版本记录</p>
      )}
    </div>
  );
}
