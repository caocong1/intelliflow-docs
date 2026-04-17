import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import NamedOutputCard from "../nodes/NamedOutputCard";

export interface NamedOutputBrowserArtifact {
  artifactId: string;
  artifactName: string;
  content: string;
  format: string;
  modelId: string;
  readonly?: boolean;
}

export interface NamedOutputBrowserSource {
  id: string;
  label: string;
  meta?: string;
  tone?: "default" | "selected" | "warning";
  artifacts: NamedOutputBrowserArtifact[];
}

export interface NamedOutputBrowserSelection {
  sourceId: string;
  sourceLabel: string;
  artifactId: string;
  artifactName: string;
  content: string;
  format: string;
  modelId: string;
}

interface NamedOutputsBrowserProps {
  sources: NamedOutputBrowserSource[];
  initialSourceId?: string;
  initialArtifactId?: string;
  emptyMessage?: string;
  onContentChange?: (params: {
    artifactId: string;
    modelId: string;
    newContent: string;
  }) => void;
  onSelectionChange?: (selection: NamedOutputBrowserSelection | null) => void;
}

const FORMAT_BADGES: Record<string, string> = {
  json: "bg-amber-50 text-amber-700 ring-amber-200",
  markdown: "bg-indigo-50 text-indigo-600 ring-indigo-200",
  text: "bg-gray-50 text-gray-600 ring-gray-200",
};

export default function NamedOutputsBrowser(props: NamedOutputsBrowserProps) {
  const [activeSourceId, setActiveSourceId] = createSignal(props.initialSourceId ?? "");
  const [activeArtifactId, setActiveArtifactId] = createSignal(props.initialArtifactId ?? "");

  const activeSource = createMemo(
    () =>
      props.sources.find((source) => source.id === activeSourceId()) ?? props.sources[0] ?? null,
  );

  const activeArtifact = createMemo(() => {
    const source = activeSource();
    if (!source) return null;
    return source.artifacts.find((artifact) => artifact.artifactId === activeArtifactId()) ?? null;
  });
  const hasArtifactRail = createMemo(() => (activeSource()?.artifacts.length ?? 0) > 1);

  createEffect(() => {
    const sources = props.sources;
    if (sources.length === 0) {
      if (activeSourceId()) setActiveSourceId("");
      if (activeArtifactId()) setActiveArtifactId("");
      return;
    }

    const nextSource =
      sources.find((source) => source.id === activeSourceId()) ??
      sources.find((source) => source.id === props.initialSourceId) ??
      sources[0];

    if (nextSource && nextSource.id !== activeSourceId()) {
      setActiveSourceId(nextSource.id);
    }
  });

  createEffect(() => {
    const source = activeSource();
    if (!source) return;

    const nextArtifact =
      source.artifacts.find((artifact) => artifact.artifactId === activeArtifactId()) ??
      source.artifacts.find((artifact) => artifact.artifactId === props.initialArtifactId) ??
      source.artifacts[0];

    if (nextArtifact && nextArtifact.artifactId !== activeArtifactId()) {
      setActiveArtifactId(nextArtifact.artifactId);
    }
  });

  createEffect(() => {
    const source = activeSource();
    const artifact = activeArtifact();

    if (!source || !artifact) {
      props.onSelectionChange?.(null);
      return;
    }

    props.onSelectionChange?.({
      sourceId: source.id,
      sourceLabel: source.label,
      artifactId: artifact.artifactId,
      artifactName: artifact.artifactName,
      content: artifact.content,
      format: artifact.format,
      modelId: artifact.modelId,
    });
  });

  return (
    <div class="rounded-2xl border border-[rgba(199,196,216,0.28)] bg-[#fcfcfe] shadow-[0_8px_30px_rgba(25,28,30,0.04)]">
      <Show when={props.sources.length > 1}>
        <div class="border-b border-[rgba(199,196,216,0.2)] px-4 pt-4 pb-3">
          <div class="flex gap-2 overflow-x-auto">
            <For each={props.sources}>
              {(source) => {
                const active = () => source.id === activeSourceId();
                return (
                  <button
                    type="button"
                    class="min-w-0 rounded-xl border px-3 py-2 text-left transition-colors"
                    classList={{
                      "border-[rgba(79,70,229,0.35)] bg-[rgba(79,70,229,0.08)]": active(),
                      "border-amber-200 bg-amber-50 hover:bg-amber-100":
                        !active() && source.tone === "warning",
                      "border-[rgba(199,196,216,0.24)] bg-white hover:bg-[#f7f9fb]": !active(),
                    }}
                    onClick={() => setActiveSourceId(source.id)}
                  >
                    <div class="flex items-center gap-2">
                      <span
                        class="text-sm font-semibold truncate"
                        classList={{
                          "text-[#3525cd]": active(),
                          "text-[#191c1e]": !active(),
                        }}
                      >
                        {source.label}
                      </span>
                      <Show when={source.tone === "selected"}>
                        <span class="inline-flex items-center rounded-full bg-[rgba(79,70,229,0.12)] px-2 py-0.5 text-[10px] font-medium text-[#4f46e5]">
                          汇总
                        </span>
                      </Show>
                      <Show when={source.tone === "warning"}>
                        <span class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          异常
                        </span>
                      </Show>
                    </div>
                    <div class="mt-1 flex items-center gap-2 text-[11px] text-[#8b8a99]">
                      <Show when={source.meta}>
                        <span
                          class="truncate"
                          classList={{ "text-amber-700": source.tone === "warning" }}
                        >
                          {source.meta}
                        </span>
                      </Show>
                      <span>{source.artifacts.length} 个输出</span>
                    </div>
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      <Show
        when={activeSource()}
        fallback={
          <div class="px-4 py-10 text-center text-sm text-[#8b8a99]">
            {props.emptyMessage ?? "暂无可展示的输出物"}
          </div>
        }
      >
        {(source) => (
          <div
            classList={{
              "grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)]": hasArtifactRail(),
              block: !hasArtifactRail(),
            }}
          >
            <Show when={hasArtifactRail()}>
              <aside class="border-b border-[rgba(199,196,216,0.2)] p-3 lg:border-b-0 lg:border-r">
                <div class="space-y-2">
                  <For each={source().artifacts}>
                    {(artifact) => {
                      const badgeClass = () => FORMAT_BADGES[artifact.format] ?? FORMAT_BADGES.text;
                      const active = () => artifact.artifactId === activeArtifactId();

                      return (
                        <button
                          type="button"
                          class="w-full rounded-xl border px-3 py-3 text-left transition-colors"
                          classList={{
                            "border-[rgba(79,70,229,0.28)] bg-[rgba(79,70,229,0.08)]": active(),
                            "border-[rgba(199,196,216,0.2)] bg-white hover:bg-[#f7f9fb]": !active(),
                          }}
                          onClick={() => setActiveArtifactId(artifact.artifactId)}
                        >
                          <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0">
                              <div
                                class="truncate text-sm font-semibold"
                                classList={{
                                  "text-[#3525cd]": active(),
                                  "text-[#191c1e]": !active(),
                                }}
                              >
                                {artifact.artifactName}
                              </div>
                              <div class="mt-1 truncate text-[11px] text-[#8b8a99]">
                                {artifact.artifactId}
                              </div>
                            </div>
                            <span
                              class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${badgeClass()}`}
                            >
                              {artifact.format.toUpperCase()}
                            </span>
                          </div>
                          <div class="mt-2 text-[11px] text-[#8b8a99]">
                            {artifact.content.length.toLocaleString()} 字符
                          </div>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </aside>
            </Show>

            <div class="p-4">
              <Show
                when={activeArtifact()}
                fallback={
                  <div class="py-10 text-center text-sm text-[#8b8a99]">暂无可展示的输出物</div>
                }
              >
                {(artifact) => (
                  <NamedOutputCard
                    artifactId={artifact().artifactId}
                    artifactName={artifact().artifactName}
                    content={artifact().content}
                    format={artifact().format}
                    modelId={artifact().modelId}
                    onContentChange={props.onContentChange}
                    readonly={artifact().readonly ?? true}
                  />
                )}
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
