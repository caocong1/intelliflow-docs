import { A, useParams } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";
import { api } from "../../api/client";
import Timeline from "../../components/ui/Timeline";
import type { TimelineItem } from "../../components/ui/Timeline";
import VersionDiff from "../../components/documents/VersionDiff";
import type { VersionDiffResult } from "@intelliflow/shared";

type VersionItem = {
  id: string;
  documentId: string;
  versionNumber: number;
  nodeId: string;
  nodeLabel: string;
  snapshotData: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  creatorName?: string;
};

type DocumentInfo = {
  id: string;
  projectId: string;
  title: string;
};

export default function VersionHistory() {
  const params = useParams<{ id: string }>();

  const [versions, setVersions] = createSignal<VersionItem[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [compareMode, setCompareMode] = createSignal(false);
  const [compareIds, setCompareIds] = createSignal<string[]>([]);
  const [diffResult, setDiffResult] = createSignal<VersionDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = createSignal(false);
  const [docInfo, setDocInfo] = createSignal<DocumentInfo | null>(null);

  const selectedVersion = () => versions().find((v) => v.id === selectedId());

  onMount(async () => {
    // Load document info for back navigation
    try {
      const docRes = await api.api.documents({ id: params.id }).get();
      if (docRes.data && !("error" in docRes.data)) {
        setDocInfo({
          id: (docRes.data as Record<string, unknown>).id as string,
          projectId: (docRes.data as Record<string, unknown>).projectId as string,
          title: (docRes.data as Record<string, unknown>).title as string,
        });
      }
    } catch {
      // Ignore — navigation still works
    }

    // Load versions
    try {
      const res = await api.api.versions.get({ query: { documentId: params.id } });
      if (res.data && "data" in res.data) {
        setVersions((res.data as unknown as { data: VersionItem[] }).data);
      }
    } catch {
      // Error loading versions
    } finally {
      setLoading(false);
    }
  });

  const timelineItems = (): TimelineItem[] =>
    versions().map((v) => ({
      id: v.id,
      label: `版本 ${v.versionNumber}`,
      sublabel: `${v.nodeLabel}${v.creatorName ? ` / ${v.creatorName}` : ""}`,
      timestamp: v.createdAt,
    }));

  function handleItemClick(id: string) {
    if (compareMode()) {
      const current = compareIds();
      if (current.includes(id)) {
        // Deselect
        setCompareIds(current.filter((c) => c !== id));
      } else if (current.length < 2) {
        const next = [...current, id];
        setCompareIds(next);

        // Auto-load diff when two selected
        if (next.length === 2) {
          loadDiff(next[0], next[1]);
        }
      }
    } else {
      setSelectedId(id);
      setDiffResult(null);
    }
  }

  async function loadDiff(idA: string, idB: string) {
    setDiffLoading(true);
    try {
      const res = await (api.api.versions as any)({ id: idA }).diff({ idB }).get();
      if (res.data && "versionA" in res.data) {
        setDiffResult(res.data as unknown as VersionDiffResult);
      }
    } catch {
      // Error loading diff
    } finally {
      setDiffLoading(false);
    }
  }

  function toggleCompareMode() {
    if (compareMode()) {
      // Exit compare mode
      setCompareMode(false);
      setCompareIds([]);
      setDiffResult(null);
    } else {
      setCompareMode(true);
      setSelectedId(null);
    }
  }

  const selectedTimelineId = () => {
    if (compareMode()) return undefined;
    return selectedId() ?? undefined;
  };

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString("zh-CN");
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Show when={docInfo()}>
              <A
                href={`/projects/${docInfo()!.projectId}`}
                class="hover:text-indigo-600 transition-colors"
              >
                返回项目
              </A>
              <span>/</span>
              <A
                href={`/documents/${params.id}`}
                class="hover:text-indigo-600 transition-colors"
              >
                {docInfo()?.title ?? "文档详情"}
              </A>
              <span>/</span>
            </Show>
            <span class="text-gray-700">版本历史</span>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">版本历史</h1>
        </div>
        <button
          onClick={toggleCompareMode}
          class={`px-4 py-2 text-sm rounded-lg transition-colors ${
            compareMode()
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          {compareMode() ? "退出对比" : "对比版本"}
        </button>
      </div>

      <Show when={compareMode() && compareIds().length < 2}>
        <div class="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm">
          请在左侧时间线中选择两个版本进行对比（已选 {compareIds().length}/2）
        </div>
      </Show>

      {/* Two-panel layout */}
      <div class="flex gap-6" style={{ "min-height": "500px" }}>
        {/* Left panel: Timeline */}
        <div class="w-1/3 bg-white rounded-xl border border-gray-200 p-4 overflow-y-auto">
          <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            时间线
          </h2>
          <Show when={!loading()} fallback={<p class="text-sm text-gray-400 text-center py-8">加载中...</p>}>
            <Timeline
              items={timelineItems()}
              onItemClick={handleItemClick}
              selectedId={selectedTimelineId()}
            />
          </Show>
        </div>

        {/* Right panel: Detail or Diff */}
        <div class="w-2/3 bg-white rounded-xl border border-gray-200 p-6 overflow-y-auto">
          {/* Compare mode: show diff */}
          <Show when={compareMode()}>
            <Show when={diffLoading()}>
              <p class="text-sm text-gray-400 text-center py-12">加载对比结果...</p>
            </Show>
            <Show when={!diffLoading() && diffResult()}>
              <VersionDiff diffResult={diffResult()!} />
            </Show>
            <Show when={!diffLoading() && !diffResult() && compareIds().length < 2}>
              <p class="text-sm text-gray-400 text-center py-12">
                请选择两个版本进行对比
              </p>
            </Show>
          </Show>

          {/* Normal mode: show version detail */}
          <Show when={!compareMode()}>
            <Show
              when={selectedVersion()}
              fallback={
                <p class="text-sm text-gray-400 text-center py-12">
                  请选择一个版本查看详情
                </p>
              }
            >
              {(version) => (
                <div class="space-y-4">
                  <h3 class="text-lg font-semibold text-gray-900">
                    版本 {version().versionNumber}
                  </h3>
                  <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span class="text-gray-500">节点：</span>
                      <span class="text-gray-800">{version().nodeLabel}</span>
                    </div>
                    <div>
                      <span class="text-gray-500">创建者：</span>
                      <span class="text-gray-800">{version().creatorName ?? "-"}</span>
                    </div>
                    <div>
                      <span class="text-gray-500">创建时间：</span>
                      <span class="text-gray-800">{formatTime(version().createdAt)}</span>
                    </div>
                    <div>
                      <span class="text-gray-500">节点 ID：</span>
                      <span class="text-gray-800 font-mono text-xs">{version().nodeId}</span>
                    </div>
                  </div>

                  {/* Snapshot content summary */}
                  <div class="mt-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">快照内容</h4>
                    <div class="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-80 overflow-y-auto">
                      <For each={Object.entries(version().snapshotData)}>
                        {([key, value]) => (
                          <div class="mb-3 last:mb-0">
                            <p class="text-xs font-medium text-gray-500 mb-1">{key}</p>
                            <p class="text-sm text-gray-700 whitespace-pre-wrap break-words font-mono">
                              {typeof value === "string"
                                ? value.length > 500
                                  ? `${value.slice(0, 500)}...`
                                  : value
                                : JSON.stringify(value, null, 2)}
                            </p>
                          </div>
                        )}
                      </For>
                      <Show when={Object.keys(version().snapshotData).length === 0}>
                        <p class="text-sm text-gray-400">无快照数据</p>
                      </Show>
                    </div>
                  </div>
                </div>
              )}
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}
