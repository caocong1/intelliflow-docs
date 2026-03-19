import { For, Show } from "solid-js";

export type ValidationError = {
  nodeId?: string;
  field?: string;
  message: string;
  severity: "error" | "warning";
};

type ValidationOverlayProps = {
  errors: ValidationError[];
  nodeLabels: Record<string, string>;
  onNavigateToNode: (nodeId: string) => void;
  onClose: () => void;
};

export default function ValidationOverlay(props: ValidationOverlayProps) {
  const errorCount = () => props.errors.filter((e) => e.severity === "error").length;
  const warningCount = () => props.errors.filter((e) => e.severity === "warning").length;

  return (
    <div class="absolute bottom-4 left-4 right-4 z-20 max-w-2xl mx-auto">
      <div class="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-slate-700">校验结果</span>
            <Show when={errorCount() > 0}>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium ring-1 ring-red-200/60">
                {/* Error icon */}
                <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <title>错误</title>
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                    clip-rule="evenodd"
                  />
                </svg>
                错误 ({errorCount()})
              </span>
            </Show>
            <Show when={warningCount() > 0}>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium ring-1 ring-amber-200/60">
                {/* Warning icon */}
                <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <title>警告</title>
                  <path
                    fill-rule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clip-rule="evenodd"
                  />
                </svg>
                警告 ({warningCount()})
              </span>
            </Show>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <title>关闭</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            关闭
          </button>
        </div>

        {/* Error list */}
        <div class="max-h-48 overflow-y-auto divide-y divide-slate-100">
          <For each={props.errors}>
            {(error) => (
              <button
                type="button"
                class={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 ${
                  error.nodeId
                    ? "hover:bg-slate-50 cursor-pointer"
                    : "cursor-default"
                }`}
                onClick={() => {
                  if (error.nodeId) {
                    props.onNavigateToNode(error.nodeId);
                  }
                }}
              >
                {/* Severity icon */}
                <span class="flex-shrink-0 mt-0.5">
                  <Show
                    when={error.severity === "error"}
                    fallback={
                      <svg class="w-4 h-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <title>警告</title>
                        <path
                          fill-rule="evenodd"
                          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    }
                  >
                    <svg class="w-4 h-4 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <title>错误</title>
                      <path
                        fill-rule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </Show>
                </span>

                {/* Message and node info */}
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-slate-700">{error.message}</p>
                  <Show when={error.nodeId}>
                    <p class="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <title>节点</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
                      </svg>
                      {props.nodeLabels[error.nodeId ?? ""] ?? error.nodeId}
                      <span class="text-indigo-400 ml-1">点击定位</span>
                    </p>
                  </Show>
                </div>

                {/* Navigate arrow for clickable items */}
                <Show when={error.nodeId}>
                  <svg class="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <title>定位到节点</title>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </Show>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
