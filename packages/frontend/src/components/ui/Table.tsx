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
                <div class="h-4 bg-gray-200 rounded animate-pulse" />
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
    <div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <For each={props.columns}>
              {(col) => (
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {col.header}
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <Show when={!props.loading} fallback={<LoadingSkeleton columns={props.columns.length} />}>
            <Show
              when={props.data.length > 0}
              fallback={
                <tr>
                  <td
                    colspan={props.columns.length}
                    class="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    {props.emptyMessage ?? "No data"}
                  </td>
                </tr>
              }
            >
              <For each={props.data}>
                {(row, index) => (
                  <tr
                    class={`transition-colors hover:bg-gray-50 ${index() % 2 === 1 ? "bg-gray-50/50" : ""}`}
                  >
                    <For each={props.columns}>
                      {(col) => <td class="px-4 py-3 text-sm text-gray-900">{col.render(row)}</td>}
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
