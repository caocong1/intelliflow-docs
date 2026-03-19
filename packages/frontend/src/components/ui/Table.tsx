import { For, type JSX, Show } from "solid-js";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => JSX.Element;
};

type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
};

function LoadingSkeleton(props: { columns: number }) {
  return (
    <For each={Array.from({ length: 5 })}>
      {() => (
        <tr>
          <For each={Array.from({ length: props.columns })}>
            {() => (
              <td class="px-4 py-3">
                <div class="h-4 bg-indigo-50 rounded animate-pulse" />
              </td>
            )}
          </For>
        </tr>
      )}
    </For>
  );
}

export default function Table<T>(props: TableProps<T>) {
  return (
    <div class="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table class="min-w-full divide-y divide-slate-200">
        <thead class="bg-slate-50">
          <tr>
            <For each={props.columns}>
              {(col) => (
                <th class="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase tracking-wider">
                  {col.header}
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-slate-100">
          <Show when={!props.loading} fallback={<LoadingSkeleton columns={props.columns.length} />}>
            <Show
              when={props.data.length > 0}
              fallback={
                <tr>
                  <td
                    colspan={props.columns.length}
                    class="px-4 py-10 text-center text-sm text-slate-400"
                  >
                    {props.emptyMessage ?? "暂无数据"}
                  </td>
                </tr>
              }
            >
              <For each={props.data}>
                {(row) => (
                  <tr class="transition-colors hover:bg-indigo-50/50">
                    <For each={props.columns}>
                      {(col) => <td class="px-4 py-3 text-sm text-slate-700">{col.render(row)}</td>}
                    </For>
                  </tr>
                )}
              </For>
            </Show>
          </Show>
        </tbody>
      </table>
    </div>
  );
}
