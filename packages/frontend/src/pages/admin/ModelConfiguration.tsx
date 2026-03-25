import { For, Show, createSignal, onMount } from "solid-js";
import { api } from "../../api/client";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { showToast } from "../../components/ui/Toast";
type ProviderType = "openai_compatible" | "opencode" | "claude_agent_sdk" | "ollama";
type DeploymentType = "cloud" | "local";

type Provider = {
  id: string;
  name: string;
  type: ProviderType;
  deploymentType: DeploymentType;
  baseUrl: string;
  apiKeyMasked: string | null;
  username: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type AgentMode = "simple_chat" | "autonomous_agent";

type Model = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  isActive: boolean;
  isProviderDisabled: boolean;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  agentMode: AgentMode | null;
  agentMaxTurns: number | null;
  agentMaxBudgetUsd: string | null;
  agentAllowedTools: string[] | null;
  createdAt: string;
  updatedAt: string;
};

type ConnectivityTestResult = {
  success: boolean;
  message: string;
  latencyMs: number;
};

type ProviderWithModels = Provider & { models: Model[] };

export default function ModelConfiguration() {
  const [providers, setProviders] = createSignal<ProviderWithModels[]>([]);
  const [loading, setLoading] = createSignal(true);

  // Provider modal state
  const [showProviderModal, setShowProviderModal] = createSignal(false);
  const [editingProvider, setEditingProvider] = createSignal<Provider | null>(null);
  const [providerForm, setProviderForm] = createSignal({
    name: "",
    type: "openai_compatible" as ProviderType,
    deploymentType: "cloud" as DeploymentType,
    baseUrl: "",
    apiKey: "",
  });

  // Model modal state
  const [showModelModal, setShowModelModal] = createSignal(false);
  const [editingModel, setEditingModel] = createSignal<Model | null>(null);
  const [modelForProvider, setModelForProvider] = createSignal<string>("");
  const [modelForm, setModelForm] = createSignal({
    modelId: "",
    displayName: "",
    temperature: null as number | null,
    maxTokens: null as number | null,
    topP: null as number | null,
    agentMode: "simple_chat" as AgentMode,
    agentMaxTurns: 15 as number | null,
    agentMaxBudgetUsd: "2.00" as string,
    agentAllowedTools: ["Read", "Write", "Glob", "Grep"] as string[],
  });

  // Delete confirm state
  const [deleteConfirm, setDeleteConfirm] = createSignal<{
    type: "provider" | "model";
    id: string;
    name: string;
  } | null>(null);

  const [submitting, setSubmitting] = createSignal(false);
  const [testingProvider, setTestingProvider] = createSignal<string | null>(null);

  // Model test state
  const [showTestModal, setShowTestModal] = createSignal(false);
  const [testingModelId, setTestingModelId] = createSignal<string>("");
  const [testingModelName, setTestingModelName] = createSignal<string>("");
  const [testPrompt, setTestPrompt] = createSignal("你好，请用一句话介绍一下你自己。");
  const [testResult, setTestResult] = createSignal<{
    loading: boolean;
    success?: boolean;
    content?: string;
    latencyMs?: number;
    errorMessage?: string;
  }>({ loading: false });

  async function fetchProviders() {
    setLoading(true);
    try {
      const { data, error } = await api.api.providers.get();
      if (error) {
        showToast("加载供应商列表失败", "error");
        return;
      }
      const result = data as unknown as { data: Provider[] };
      const providerList = result.data;

      // Fetch models for each provider
      const withModels: ProviderWithModels[] = await Promise.all(
        providerList.map(async (p) => {
          try {
            const { data: modelData, error: modelError } =
              await api.api.models["by-provider"]({ providerId: p.id }).get();
            if (modelError) return { ...p, models: [] };
            const modelResult = modelData as unknown as { data: Model[] };
            return { ...p, models: modelResult.data };
          } catch {
            return { ...p, models: [] };
          }
        }),
      );

      setProviders(withModels);
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(fetchProviders);

  // --- Provider CRUD ---

  function openCreateProvider() {
    setEditingProvider(null);
    setProviderForm({
      name: "",
      type: "openai_compatible",
      deploymentType: "cloud",
      baseUrl: "",
      apiKey: "",
    });
    setShowProviderModal(true);
  }

  function openEditProvider(provider: Provider) {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name,
      type: provider.type,
      deploymentType: provider.deploymentType,
      baseUrl: provider.baseUrl,
      apiKey: "",
    });
    setShowProviderModal(true);
  }

  async function handleProviderSubmit() {
    const form = providerForm();
    if (!form.name.trim() || !form.baseUrl.trim()) {
      showToast("请填写必填字段", "error");
      return;
    }
    const editing = editingProvider();

    setSubmitting(true);
    try {
      if (editing) {
        // Update
        const body: Record<string, string> = {
          name: form.name,
          baseUrl: form.baseUrl,
        };
        if (form.apiKey) {
          body.apiKey = form.apiKey;
        }
        const { error } = await api.api.providers({ id: editing.id }).patch(body);
        if (error) {
          const errData = error.value as { error?: string } | undefined;
          showToast(errData?.error ?? "更新供应商失败", "error");
          return;
        }
        showToast("供应商更新成功", "success");
      } else {
        // Create
        const body: {
          name: string;
          baseUrl: string;
          type?: ProviderType;
          deploymentType?: DeploymentType;
          apiKey?: string;
          username?: string;
        } = {
          name: form.name,
          baseUrl: form.baseUrl,
          type: form.type,
          deploymentType: form.deploymentType,
        };
        if (!form.apiKey.trim()) {
          showToast("请填写 API Key", "error");
          setSubmitting(false);
          return;
        }
        body.apiKey = form.apiKey;
        const { error } = await api.api.providers.post(body);
        if (error) {
          const errData = error.value as { error?: string } | undefined;
          showToast(errData?.error ?? "创建供应商失败", "error");
          return;
        }
        showToast("供应商创建成功", "success");
      }
      setShowProviderModal(false);
      await fetchProviders();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleProvider(provider: Provider) {
    try {
      const { error } = await api.api.providers({ id: provider.id }).status.patch();
      if (error) {
        showToast("操作失败", "error");
        return;
      }
      showToast(provider.isActive ? "供应商已停用" : "供应商已启用", "success");
      await fetchProviders();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    }
  }

  async function handleTestConnection(provider: ProviderWithModels) {
    setTestingProvider(provider.id);
    try {
      const body = provider.models.length > 0 ? { modelId: provider.models[0].modelId } : undefined;
      const { data, error } = await api.api.providers({ id: provider.id }).test.post(body);
      if (error) {
        showToast("连接测试失败", "error");
        return;
      }
      const result = data as unknown as ConnectivityTestResult;
      if (result.success) {
        showToast(`连接成功, 延迟: ${result.latencyMs}ms`, "success");
      } else {
        showToast(result.message || "连接失败", "error");
      }
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setTestingProvider(null);
    }
  }

  // --- Model CRUD ---

  function openCreateModel(providerId: string) {
    setEditingModel(null);
    setModelForProvider(providerId);
    setModelForm({
      modelId: "", displayName: "", temperature: null, maxTokens: null, topP: null,
      agentMode: "simple_chat", agentMaxTurns: 15, agentMaxBudgetUsd: "2.00",
      agentAllowedTools: ["Read", "Write", "Glob", "Grep"],
    });
    setShowModelModal(true);
  }

  function openEditModel(model: Model) {
    setEditingModel(model);
    setModelForProvider(model.providerId);
    setModelForm({
      modelId: model.modelId,
      displayName: model.displayName,
      temperature: model.temperature ?? null,
      maxTokens: model.maxTokens ?? null,
      topP: model.topP ?? null,
      agentMode: model.agentMode ?? "simple_chat",
      agentMaxTurns: model.agentMaxTurns ?? 15,
      agentMaxBudgetUsd: model.agentMaxBudgetUsd ?? "2.00",
      agentAllowedTools: model.agentAllowedTools ?? ["Read", "Write", "Glob", "Grep"],
    });
    setShowModelModal(true);
  }

  async function handleModelSubmit() {
    const form = modelForm();
    if (!form.modelId.trim() || !form.displayName.trim()) {
      showToast("请填写必填字段", "error");
      return;
    }
    const editing = editingModel();

    setSubmitting(true);
    try {
      // Check if provider is claude_agent_sdk
      const currentProvider = providers().find((p) => p.id === modelForProvider());
      const isAgentSdk = currentProvider?.type === "claude_agent_sdk";

      if (editing) {
        const { error } = await api.api.models({ id: editing.id }).patch({
          modelId: form.modelId,
          displayName: form.displayName,
          temperature: form.temperature,
          maxTokens: form.maxTokens,
          topP: form.topP,
          ...(isAgentSdk && {
            agentMode: form.agentMode,
            agentMaxTurns: form.agentMaxTurns,
            agentMaxBudgetUsd: form.agentMaxBudgetUsd,
            agentAllowedTools: form.agentAllowedTools,
          }),
        });
        if (error) {
          const errData = error.value as { error?: string } | undefined;
          showToast(errData?.error ?? "更新模型失败", "error");
          return;
        }
        showToast("模型更新成功", "success");
      } else {
        const { error } = await api.api.models.post({
          providerId: modelForProvider(),
          modelId: form.modelId,
          displayName: form.displayName,
          temperature: form.temperature,
          maxTokens: form.maxTokens,
          topP: form.topP,
          ...(isAgentSdk && {
            agentMode: form.agentMode,
            agentMaxTurns: form.agentMaxTurns,
            agentMaxBudgetUsd: form.agentMaxBudgetUsd,
            agentAllowedTools: form.agentAllowedTools,
          }),
        });
        if (error) {
          const errData = error.value as { error?: string } | undefined;
          showToast(errData?.error ?? "创建模型失败", "error");
          return;
        }
        showToast("模型创建成功", "success");
      }
      setShowModelModal(false);
      await fetchProviders();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleModel(model: Model) {
    try {
      const { error } = await api.api.models({ id: model.id }).status.patch();
      if (error) {
        showToast("操作失败", "error");
        return;
      }
      showToast(model.isActive ? "模型已停用" : "模型已启用", "success");
      await fetchProviders();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    }
  }

  // --- Delete ---

  async function handleDelete() {
    const confirm = deleteConfirm();
    if (!confirm) return;

    setSubmitting(true);
    try {
      if (confirm.type === "provider") {
        const { error } = await api.api.providers({ id: confirm.id }).delete();
        if (error) {
          const errData = error.value as { error?: string } | undefined;
          showToast(errData?.error ?? "删除供应商失败", "error");
          return;
        }
        showToast("供应商已删除", "success");
      } else {
        const { error } = await api.api.models({ id: confirm.id }).delete();
        if (error) {
          const errData = error.value as { error?: string } | undefined;
          showToast(errData?.error ?? "删除模型失败", "error");
          return;
        }
        showToast("模型已删除", "success");
      }
      setDeleteConfirm(null);
      await fetchProviders();
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Model Test ---

  function openTestModel(model: Model) {
    setTestingModelId(model.id);
    setTestingModelName(model.displayName);
    setTestResult({ loading: false });
    setShowTestModal(true);
  }

  async function handleTestModel() {
    const modelId = testingModelId();
    const prompt = testPrompt();
    if (!prompt.trim()) {
      showToast("请输入测试提示词", "error");
      return;
    }

    setTestResult({ loading: true });
    try {
      const { data, error } = await api.api.models({ id: modelId }).test.post({ prompt });
      if (error) {
        setTestResult({ loading: false, success: false, errorMessage: "请求失败" });
        return;
      }
      const result = data as unknown as {
        success: boolean;
        content: string;
        latencyMs: number;
        errorMessage?: string;
      };
      setTestResult({
        loading: false,
        success: result.success,
        content: result.content,
        latencyMs: result.latencyMs,
        errorMessage: result.errorMessage,
      });
    } catch {
      setTestResult({ loading: false, success: false, errorMessage: "网络错误" });
    }
  }

  // --- Style classes ---
  const inputClass =
    "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";
  const cancelBtnClass =
    "px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const primaryBtnClass =
    "px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2";
  const actionBtnClass =
    "text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1.5 py-0.5";

  function modelStatusLabel(model: Model): string {
    if (model.isProviderDisabled) return "供应商已停用";
    return model.isActive ? "已启用" : "已停用";
  }

  function modelStatusVariant(model: Model): "success" | "error" | "warning" {
    if (model.isProviderDisabled) return "warning";
    return model.isActive ? "success" : "error";
  }

  return (
    <div class="p-6">
      {/* Page Header */}
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-indigo-950">AI 模型配置</h1>
          <p class="text-sm text-slate-400 mt-0.5">管理 AI 供应商与模型</p>
        </div>
        <button
          type="button"
          onClick={openCreateProvider}
          class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>添加</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          添加供应商
        </button>
      </div>

      {/* Loading State */}
      <Show when={loading()}>
        <div class="space-y-4">
          <For each={[1, 2]}>
            {() => (
              <div class="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                <div class="h-5 bg-slate-200 rounded w-1/4 mb-3" />
                <div class="h-4 bg-slate-100 rounded w-1/3 mb-4" />
                <div class="h-20 bg-slate-50 rounded" />
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Empty State */}
      <Show when={!loading() && providers().length === 0}>
        <div class="text-center py-16 bg-white rounded-xl border border-slate-200">
          <svg class="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>无数据</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p class="text-sm text-slate-500 mb-4">暂无 AI 供应商配置</p>
          <button
            type="button"
            onClick={openCreateProvider}
            class="text-sm text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer transition-colors"
          >
            添加第一个供应商
          </button>
        </div>
      </Show>

      {/* Provider Cards */}
      <Show when={!loading() && providers().length > 0}>
        <div class="space-y-4">
          <For each={providers()}>
            {(provider) => (
              <div
                class={`bg-white rounded-xl border border-slate-200 overflow-hidden transition-opacity duration-200 ${
                  !provider.isActive ? "opacity-70" : ""
                }`}
              >
                {/* Card Header */}
                <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div class="flex items-center gap-3 min-w-0">
                    <h3 class="text-base font-semibold text-indigo-950 truncate">{provider.name}</h3>
                    <Badge
                      label={provider.type === "openai_compatible" ? "OpenAI 兼容" : provider.type === "claude_agent_sdk" ? "Claude Agent SDK" : provider.type === "ollama" ? "Ollama" : "OpenCode"}
                      variant="info"
                    />
                    <Badge
                      label={provider.deploymentType === "cloud" ? "云端" : "本地"}
                      variant={provider.deploymentType === "cloud" ? "info" : "warning"}
                    />
                    <Badge
                      label={provider.isActive ? "已启用" : "已停用"}
                      variant={provider.isActive ? "success" : "error"}
                    />
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTestConnection(provider)}
                      disabled={testingProvider() === provider.id}
                      class={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        testingProvider() === provider.id
                          ? "border-slate-200 text-slate-400 bg-slate-50"
                          : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                      }`}
                    >
                      <Show
                        when={testingProvider() !== provider.id}
                        fallback={
                          <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                            <title>测试中</title>
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        }
                      >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <title>测试连接</title>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </Show>
                      {testingProvider() === provider.id ? "测试中..." : "测试连接"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditProvider(provider)}
                      class={`${actionBtnClass} text-indigo-600 hover:text-indigo-800`}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleProvider(provider)}
                      class={`${actionBtnClass} ${
                        provider.isActive
                          ? "text-amber-600 hover:text-amber-800"
                          : "text-emerald-600 hover:text-emerald-800"
                      }`}
                    >
                      {provider.isActive ? "停用" : "启用"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({ type: "provider", id: provider.id, name: provider.name })
                      }
                      class={`${actionBtnClass} text-red-600 hover:text-red-800`}
                    >
                      删除
                    </button>
                  </div>
                </div>


                {/* Model List */}
                <div class={`${!provider.isActive ? "opacity-50" : ""} transition-opacity duration-200`}>
                  <Show
                    when={provider.models.length > 0}
                    fallback={
                      <div class="px-6 py-6 text-center text-sm text-slate-400">
                        暂无模型
                      </div>
                    }
                  >
                    <div class="divide-y divide-slate-100">
                      <div class="grid grid-cols-[1fr_1fr_80px_200px] gap-4 px-6 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50/80">
                        <span>显示名称</span>
                        <span>模型 ID</span>
                        <span class="text-center">状态</span>
                        <span class="text-right">操作</span>
                      </div>
                      <For each={provider.models}>
                        {(model) => (
                          <div
                            class={`grid grid-cols-[1fr_1fr_80px_200px] gap-4 px-6 py-3 items-center text-sm ${
                              model.isProviderDisabled ? "opacity-50" : ""
                            }`}
                          >
                            <span class="font-medium text-slate-900 truncate">{model.displayName}</span>
                            <span class="text-slate-500 truncate font-mono text-xs">{model.modelId}</span>
                            <div class="text-center">
                              <Badge
                                label={modelStatusLabel(model)}
                                variant={modelStatusVariant(model)}
                              />
                            </div>
                            <div class="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openTestModel(model)}
                                class={`${actionBtnClass} text-cyan-600 hover:text-cyan-800`}
                              >
                                测试
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModel(model)}
                                class={`${actionBtnClass} text-indigo-600 hover:text-indigo-800`}
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleModel(model)}
                                class={`${actionBtnClass} ${
                                  model.isActive
                                    ? "text-amber-600 hover:text-amber-800"
                                    : "text-emerald-600 hover:text-emerald-800"
                                }`}
                              >
                                {model.isActive ? "停用" : "启用"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirm({
                                    type: "model",
                                    id: model.id,
                                    name: model.displayName,
                                  })
                                }
                                class={`${actionBtnClass} text-red-600 hover:text-red-800`}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>

                  {/* Add Model Button */}
                  <div class="px-6 py-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openCreateModel(provider.id)}
                      class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <title>添加模型</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      添加模型
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Provider Create/Edit Modal */}
      <Modal
        isOpen={showProviderModal()}
        onClose={() => setShowProviderModal(false)}
        title={editingProvider() ? "编辑供应商" : "添加供应商"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleProviderSubmit();
          }}
          class="space-y-4"
        >
          <div>
            <label for="provider-type" class={labelClass}>类型</label>
            <select
              id="provider-type"
              value={providerForm().type}
              onChange={(e) =>
                setProviderForm((f) => ({ ...f, type: e.currentTarget.value as ProviderType }))
              }
              class={inputClass}
              disabled={!!editingProvider()}
            >
              <option value="openai_compatible">OpenAI 兼容</option>
              <option value="opencode">OpenCode Server</option>
              <option value="claude_agent_sdk">Claude Agent SDK</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>
          <div>
            <label for="provider-deployment" class={labelClass}>部署类型</label>
            <select
              id="provider-deployment"
              value={providerForm().deploymentType}
              onChange={(e) =>
                setProviderForm((f) => ({ ...f, deploymentType: e.currentTarget.value as DeploymentType }))
              }
              class={inputClass}
            >
              <option value="cloud">云端</option>
              <option value="local">本地</option>
            </select>
          </div>
          <div>
            <label for="provider-name" class={labelClass}>名称</label>
            <input
              id="provider-name"
              type="text"
              value={providerForm().name}
              onInput={(e) => setProviderForm((f) => ({ ...f, name: e.currentTarget.value }))}
              class={inputClass}
              placeholder="供应商名称"
              required
            />
          </div>
          <div>
            <label for="provider-baseurl" class={labelClass}>Base URL</label>
            <input
              id="provider-baseurl"
              type="text"
              value={providerForm().baseUrl}
              onInput={(e) => setProviderForm((f) => ({ ...f, baseUrl: e.currentTarget.value }))}
              class={inputClass}
              placeholder={
                providerForm().type === "openai_compatible"
                  ? "https://ark.cn-beijing.volces.com/api/v3"
                  : providerForm().type === "claude_agent_sdk"
                    ? "https://ark.cn-beijing.volces.com/api/coding"
                    : providerForm().type === "ollama"
                      ? "http://localhost:11434"
                      : "http://localhost:4096"
              }
              required
            />
          </div>

          {/* API Key field — all provider types use API Key */}
          <div>
            <label for="provider-apikey" class={labelClass}>API Key</label>
            <input
              id="provider-apikey"
              type="password"
              value={providerForm().apiKey}
              onInput={(e) => setProviderForm((f) => ({ ...f, apiKey: e.currentTarget.value }))}
              class={inputClass}
              placeholder={
                editingProvider()
                  ? "保持原密钥不变，或输入新密钥"
                  : providerForm().type === "ollama"
                    ? "可选，Ollama 通常无需密钥"
                    : providerForm().type === "claude_agent_sdk"
                      ? "火山方舟 API Key"
                      : providerForm().type === "opencode"
                        ? "OpenCode Serve API Key"
                        : "sk-..."
              }
              required={!editingProvider() && providerForm().type !== "ollama"}
            />
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowProviderModal(false)}
              class={cancelBtnClass}
            >
              取消
            </button>
            <button type="submit" disabled={submitting()} class={primaryBtnClass}>
              {submitting() ? "保存中..." : editingProvider() ? "保存" : "创建"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Model Create/Edit Modal */}
      <Modal
        isOpen={showModelModal()}
        onClose={() => setShowModelModal(false)}
        title={editingModel() ? "编辑模型" : "添加模型"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleModelSubmit();
          }}
          class="space-y-4"
        >
          <div>
            <label for="model-id" class={labelClass}>模型 ID</label>
            <input
              id="model-id"
              type="text"
              value={modelForm().modelId}
              onInput={(e) => setModelForm((f) => ({ ...f, modelId: e.currentTarget.value }))}
              class={inputClass}
              placeholder="doubao-seed-2.0-pro"
              required
            />
          </div>
          <div>
            <label for="model-displayname" class={labelClass}>显示名称</label>
            <input
              id="model-displayname"
              type="text"
              value={modelForm().displayName}
              onInput={(e) => setModelForm((f) => ({ ...f, displayName: e.currentTarget.value }))}
              class={inputClass}
              placeholder="Doubao Seed Pro"
              required
            />
          </div>

          {/* Parameter Configuration */}
          <div class="border-t border-slate-200 pt-4 mt-4">
            <p class="text-sm font-medium text-slate-700 mb-1">参数配置（可选）</p>
            <p class="text-xs text-slate-400 mb-3">留空使用 API 默认值</p>

            <div class="space-y-4">
              <div>
                <label for="model-temperature" class={labelClass}>Temperature</label>
                <input
                  id="model-temperature"
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={modelForm().temperature ?? ""}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    setModelForm((f) => ({ ...f, temperature: val === "" ? null : Number.parseFloat(val) }));
                  }}
                  class={inputClass}
                  placeholder="0.0 - 2.0"
                />
              </div>
              <div>
                <label for="model-maxtokens" class={labelClass}>Max Tokens</label>
                <input
                  id="model-maxtokens"
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  value={modelForm().maxTokens ?? ""}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    setModelForm((f) => ({ ...f, maxTokens: val === "" ? null : Number.parseInt(val, 10) }));
                  }}
                  class={inputClass}
                  placeholder="1 - 1000000"
                />
              </div>
              <div>
                <label for="model-topp" class={labelClass}>Top P</label>
                <input
                  id="model-topp"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={modelForm().topP ?? ""}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    setModelForm((f) => ({ ...f, topP: val === "" ? null : Number.parseFloat(val) }));
                  }}
                  class={inputClass}
                  placeholder="0.0 - 1.0"
                />
              </div>
            </div>
          </div>

          {/* Agent SDK Configuration (only for claude_agent_sdk providers) */}
          <Show when={providers().find((p) => p.id === modelForProvider())?.type === "claude_agent_sdk"}>
            <div class="border-t border-slate-200 pt-4 mt-4">
              <p class="text-sm font-medium text-slate-700 mb-1">Agent SDK 配置</p>
              <p class="text-xs text-slate-400 mb-3">Claude Agent SDK 专属参数</p>

              <div class="space-y-4">
                <div>
                  <label for="model-agent-mode" class={labelClass}>运行模式</label>
                  <select
                    id="model-agent-mode"
                    value={modelForm().agentMode}
                    onChange={(e) =>
                      setModelForm((f) => ({ ...f, agentMode: e.currentTarget.value as AgentMode }))
                    }
                    class={inputClass}
                  >
                    <option value="simple_chat">简单对话（Simple Chat）</option>
                    <option value="autonomous_agent">自主 Agent（Autonomous）</option>
                  </select>
                </div>
                <div>
                  <label for="model-max-turns" class={labelClass}>最大交互轮数</label>
                  <input
                    id="model-max-turns"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={modelForm().agentMaxTurns ?? ""}
                    onInput={(e) => {
                      const val = e.currentTarget.value;
                      setModelForm((f) => ({ ...f, agentMaxTurns: val === "" ? null : Number.parseInt(val, 10) }));
                    }}
                    class={inputClass}
                    placeholder="15"
                  />
                </div>
                <div>
                  <label for="model-max-budget" class={labelClass}>预算上限（USD）</label>
                  <input
                    id="model-max-budget"
                    type="text"
                    value={modelForm().agentMaxBudgetUsd}
                    onInput={(e) =>
                      setModelForm((f) => ({ ...f, agentMaxBudgetUsd: e.currentTarget.value }))
                    }
                    class={inputClass}
                    placeholder="2.00"
                  />
                </div>
                <Show when={modelForm().agentMode === "autonomous_agent"}>
                  <div>
                    <label for="model-allowed-tools" class={labelClass}>允许的内置工具</label>
                    <div id="model-allowed-tools" class="flex flex-wrap gap-2 mt-1">
                      <For each={["Read", "Write", "Glob", "Grep", "Edit", "Bash"]}>
                        {(tool) => {
                          const isChecked = () => modelForm().agentAllowedTools.includes(tool);
                          return (
                            <label class="inline-flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked()}
                                onChange={() => {
                                  setModelForm((f) => ({
                                    ...f,
                                    agentAllowedTools: isChecked()
                                      ? f.agentAllowedTools.filter((t) => t !== tool)
                                      : [...f.agentAllowedTools, tool],
                                  }));
                                }}
                                class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              {tool}
                            </label>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModelModal(false)}
              class={cancelBtnClass}
            >
              取消
            </button>
            <button type="submit" disabled={submitting()} class={primaryBtnClass}>
              {submitting() ? "保存中..." : editingModel() ? "保存" : "创建"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm()}
        onClose={() => setDeleteConfirm(null)}
        title={deleteConfirm()?.type === "provider" ? "确认删除供应商" : "确认删除模型"}
      >
        <div class="space-y-4">
          <p class="text-sm text-slate-600">
            确定要删除{deleteConfirm()?.type === "provider" ? "供应商" : "模型"}
            「{deleteConfirm()?.name}」吗？此操作不可恢复。
          </p>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteConfirm(null)}
              class={cancelBtnClass}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting()}
              class="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              {submitting() ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Model Test Modal */}
      <Modal
        isOpen={showTestModal()}
        onClose={() => setShowTestModal(false)}
        title={`测试模型 — ${testingModelName()}`}
      >
        <div class="space-y-4">
          <div>
            <label for="test-prompt" class={labelClass}>测试提示词</label>
            <textarea
              id="test-prompt"
              value={testPrompt()}
              onInput={(e) => setTestPrompt(e.currentTarget.value)}
              class={`${inputClass} min-h-[80px] resize-y`}
              placeholder="输入提示词..."
              rows={3}
            />
          </div>
          <div class="flex justify-end">
            <button
              type="button"
              onClick={handleTestModel}
              disabled={testResult().loading}
              class={primaryBtnClass}
            >
              {testResult().loading ? "请求中..." : "发送测试"}
            </button>
          </div>
          <Show when={testResult().loading}>
            <div class="flex items-center gap-2 text-sm text-slate-500">
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <title>加载中</title>
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              正在等待模型响应...
            </div>
          </Show>
          <Show when={!testResult().loading && testResult().success !== undefined}>
            <div class={`rounded-lg border p-4 ${testResult().success ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <div class="flex items-center justify-between mb-2">
                <span class={`text-xs font-medium ${testResult().success ? "text-emerald-700" : "text-red-700"}`}>
                  {testResult().success ? "测试成功" : "测试失败"}
                </span>
                <Show when={testResult().latencyMs !== undefined}>
                  <span class="text-xs text-slate-500">耗时 {testResult().latencyMs}ms</span>
                </Show>
              </div>
              <Show when={testResult().success}>
                <pre class="text-sm text-slate-800 whitespace-pre-wrap break-words font-sans leading-relaxed max-h-[300px] overflow-y-auto">{testResult().content}</pre>
              </Show>
              <Show when={!testResult().success}>
                <p class="text-sm text-red-600">{testResult().errorMessage ?? "未知错误"}</p>
              </Show>
            </div>
          </Show>
        </div>
      </Modal>
    </div>
  );
}
