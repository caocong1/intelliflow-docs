import type { Component } from "solid-js";
import { For, createMemo, createSignal, onMount } from "solid-js";
import { showToast } from "../../components/ui/Toast";
import { listActiveModelOptions } from "../../lib/api/models-catalog";
import {
  getPptAgentConfig,
  testPptAgentTextConnection,
  updatePptAgentConfig,
} from "../../lib/api/ppt-agent-config";

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/15";

type ModelOption = {
  modelId: string;
  displayName: string;
  providerName?: string | null;
};

const PptAgentConfig: Component = () => {
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [modelOptions, setModelOptions] = createSignal<ModelOption[]>([]);
  const [form, setForm] = createSignal({
    name: "",
    baseUrl: "",
    apiKey: "",
    apiKeyEnvVar: "",
    textModel: "",
    textEndpoint: "",
    imageModel: "",
    imageEndpoint: "",
    imageAspectRatio: "16:9",
    imagePromptOptimizer: true,
    temperature: 0.35,
    maxCompletionTokens: 9000,
    textTimeoutMs: 600000,
    imageTimeoutMs: 600000,
    isActive: true,
    apiKeyConfigured: false,
  });
  const groupedModelOptions = createMemo(() => {
    const groups = new Map<string, ModelOption[]>();
    for (const item of modelOptions()) {
      const label = item.providerName?.trim() || "未标记 Provider";
      const bucket = groups.get(label);
      if (bucket) bucket.push(item);
      else groups.set(label, [item]);
    }
    return Array.from(groups.entries()).map(([providerName, items]) => ({ providerName, items }));
  });

  async function loadConfig() {
    setLoading(true);
    try {
      const cfg = await getPptAgentConfig();
      setForm({
        ...form(),
        ...cfg,
        apiKey: "",
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "加载配置失败", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadModelOptions() {
    try {
      const models = await listActiveModelOptions();
      setModelOptions(
        models.map((m) => ({
          modelId: m.modelId,
          displayName: m.displayName,
          providerName: m.providerName,
        })),
      );
    } catch {
      // model list is auxiliary only
    }
  }

  onMount(() => {
    void loadConfig();
    void loadModelOptions();
  });

  async function handleSave(e: Event) {
    e.preventDefault();
    setSaving(true);
    try {
      const current = form();
      const updated = await updatePptAgentConfig({
        name: current.name,
        baseUrl: current.baseUrl,
        apiKey: current.apiKey || undefined,
        apiKeyEnvVar: current.apiKeyEnvVar,
        textModel: current.textModel,
        textEndpoint: current.textEndpoint,
        imageModel: current.imageModel,
        imageEndpoint: current.imageEndpoint,
        imageAspectRatio: current.imageAspectRatio,
        imagePromptOptimizer: current.imagePromptOptimizer,
        temperature: current.temperature,
        maxCompletionTokens: current.maxCompletionTokens,
        textTimeoutMs: current.textTimeoutMs,
        imageTimeoutMs: current.imageTimeoutMs,
        isActive: current.isActive,
      });
      setForm((prev) => ({ ...prev, ...updated, apiKey: "" }));
      showToast("PPT Agent 模型配置已保存", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const result = await testPptAgentTextConnection();
      showToast(result.latencyMs ? `连接成功（${result.latencyMs}ms）` : result.message, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "连接测试失败", "error");
    } finally {
      setTesting(false);
    }
  }

  if (loading()) {
    return <div class="p-6 text-sm text-stone-600">加载中...</div>;
  }

  return (
    <div class="p-6">
      <h1 class="text-xl font-bold text-indigo-950">PPT Agent 配置</h1>
      <p class="mt-1 text-sm text-slate-500">
        分别配置 Deck 文案模型与图片模型，并供 PPT 生成页关联使用。
      </p>

      <form
        onSubmit={handleSave}
        class="mt-6 space-y-5 rounded-lg border border-stone-200 bg-white p-5"
      >
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">配置名称</div>
            <input
              class={inputClass}
              value={form().name}
              onInput={(e) => setForm((v) => ({ ...v, name: e.currentTarget.value }))}
            />
          </label>
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">Base URL</div>
            <input
              class={inputClass}
              value={form().baseUrl}
              onInput={(e) => setForm((v) => ({ ...v, baseUrl: e.currentTarget.value }))}
            />
          </label>
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">API Key（留空不改）</div>
            <input
              type="password"
              class={inputClass}
              value={form().apiKey}
              onInput={(e) => setForm((v) => ({ ...v, apiKey: e.currentTarget.value }))}
              placeholder={form().apiKeyConfigured ? "已配置，留空保持不变" : "输入新的 API Key"}
            />
          </label>
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">API Key 环境变量</div>
            <input
              class={inputClass}
              value={form().apiKeyEnvVar}
              onInput={(e) => setForm((v) => ({ ...v, apiKeyEnvVar: e.currentTarget.value }))}
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">Deck 生成模型（Text）</div>
            <select
              class={`${inputClass} mb-2`}
              value={form().textModel}
              onChange={(e) => setForm((v) => ({ ...v, textModel: e.currentTarget.value }))}
            >
              <option value="">请选择</option>
              <For each={groupedModelOptions()}>
                {(group) => (
                  <optgroup label={group.providerName}>
                    <For each={group.items}>
                      {(item) => (
                        <option value={item.modelId}>
                          {item.displayName} ({item.modelId})
                        </option>
                      )}
                    </For>
                  </optgroup>
                )}
              </For>
            </select>
            <input
              class={inputClass}
              value={form().textModel}
              onInput={(e) => setForm((v) => ({ ...v, textModel: e.currentTarget.value }))}
            />
          </label>
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">Deck Endpoint</div>
            <input
              class={inputClass}
              value={form().textEndpoint}
              onInput={(e) => setForm((v) => ({ ...v, textEndpoint: e.currentTarget.value }))}
            />
          </label>
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">图片生成模型（Image）</div>
            <select
              class={`${inputClass} mb-2`}
              value={form().imageModel}
              onChange={(e) => setForm((v) => ({ ...v, imageModel: e.currentTarget.value }))}
            >
              <option value="">请选择</option>
              <For each={groupedModelOptions()}>
                {(group) => (
                  <optgroup label={group.providerName}>
                    <For each={group.items}>
                      {(item) => (
                        <option value={item.modelId}>
                          {item.displayName} ({item.modelId})
                        </option>
                      )}
                    </For>
                  </optgroup>
                )}
              </For>
            </select>
            <input
              class={inputClass}
              value={form().imageModel}
              onInput={(e) => setForm((v) => ({ ...v, imageModel: e.currentTarget.value }))}
            />
          </label>
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">图片 Endpoint</div>
            <input
              class={inputClass}
              value={form().imageEndpoint}
              onInput={(e) => setForm((v) => ({ ...v, imageEndpoint: e.currentTarget.value }))}
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">温度</div>
            <input
              type="number"
              min="0"
              max="2"
              step="0.01"
              class={inputClass}
              value={form().temperature}
              onInput={(e) =>
                setForm((v) => ({ ...v, temperature: Number(e.currentTarget.value) || 0 }))
              }
            />
          </label>
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">最大 Tokens</div>
            <input
              type="number"
              min="1"
              class={inputClass}
              value={form().maxCompletionTokens}
              onInput={(e) =>
                setForm((v) => ({ ...v, maxCompletionTokens: Number(e.currentTarget.value) || 1 }))
              }
            />
          </label>
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">Text 超时(ms)</div>
            <input
              type="number"
              min="1000"
              class={inputClass}
              value={form().textTimeoutMs}
              onInput={(e) =>
                setForm((v) => ({ ...v, textTimeoutMs: Number(e.currentTarget.value) || 1000 }))
              }
            />
          </label>
          <label class="text-sm">
            <div class="mb-1 font-medium text-stone-800">Image 超时(ms)</div>
            <input
              type="number"
              min="1000"
              class={inputClass}
              value={form().imageTimeoutMs}
              onInput={(e) =>
                setForm((v) => ({ ...v, imageTimeoutMs: Number(e.currentTarget.value) || 1000 }))
              }
            />
          </label>
        </div>

        <div class="flex items-center gap-6 text-sm">
          <label class="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form().imagePromptOptimizer}
              onChange={(e) =>
                setForm((v) => ({ ...v, imagePromptOptimizer: e.currentTarget.checked }))
              }
            />
            开启图片 Prompt 优化
          </label>
          <label class="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form().isActive}
              onChange={(e) => setForm((v) => ({ ...v, isActive: e.currentTarget.checked }))}
            />
            启用此配置
          </label>
        </div>

        <div class="flex gap-3">
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing()}
            class="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-800 hover:bg-stone-100 disabled:opacity-60"
          >
            {testing() ? "测试中..." : "测试 Text 连接"}
          </button>
          <button
            type="submit"
            disabled={saving()}
            class="rounded-md bg-[#6f3f25] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5f341e] disabled:opacity-60"
          >
            {saving() ? "保存中..." : "保存配置"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PptAgentConfig;
