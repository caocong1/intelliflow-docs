import { A, useNavigate, useParams } from "@solidjs/router";
import { createSignal, onMount, Show } from "solid-js";
import { api } from "../../api/client";
import Badge from "../../components/ui/Badge";
import VisibilityBadge from "../../components/documents/VisibilityBadge";

type DocumentInfo = {
  id: string;
  projectId: string;
  workflowId: string;
  title: string;
  description: string | null;
  status: "draft" | "in_progress" | "completed";
  visibility: "self" | "project" | "specific";
  createdBy: string;
  creatorName: string;
  workflowName: string;
  createdAt: string;
  updatedAt: string;
};

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "info" }> = {
  draft: { label: "草稿", variant: "info" },
  in_progress: { label: "进行中", variant: "warning" },
  completed: { label: "已完成", variant: "success" },
};

export default function DocumentDetail() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = createSignal<DocumentInfo | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const res = await api.api.documents({ id: params.id }).get();
      if (res.data && !("error" in res.data)) {
        setDoc(res.data as unknown as DocumentInfo);
      } else {
        setError("文档不存在或无权访问");
      }
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  });

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString("zh-CN");
  }

  return (
    <div class="space-y-6">
      <Show when={!loading()} fallback={<p class="text-center text-gray-400 py-12">加载中...</p>}>
        <Show when={error()}>
          <div class="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error()}</div>
        </Show>

        <Show when={doc()}>
          {(docData) => (
            <>
              {/* Breadcrumb */}
              <div class="flex items-center gap-2 text-sm text-gray-500">
                <A
                  href={`/projects/${docData().projectId}`}
                  class="hover:text-indigo-600 transition-colors"
                >
                  返回项目
                </A>
                <span>/</span>
                <span class="text-gray-700">{docData().title}</span>
              </div>

              {/* Document info card */}
              <div class="bg-white rounded-xl border border-gray-200 p-6">
                <div class="flex items-start justify-between mb-6">
                  <div>
                    <h1 class="text-2xl font-bold text-gray-900 mb-2">
                      {docData().title}
                    </h1>
                    <Show when={docData().description}>
                      <p class="text-gray-600 text-sm">{docData().description}</p>
                    </Show>
                  </div>
                  <div class="flex items-center gap-2">
                    <Badge
                      label={statusMap[docData().status]?.label ?? docData().status}
                      variant={statusMap[docData().status]?.variant ?? "info"}
                    />
                    <VisibilityBadge visibility={docData().visibility} />
                  </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p class="text-gray-500 mb-1">创建者</p>
                    <p class="text-gray-800 font-medium">{docData().creatorName}</p>
                  </div>
                  <div>
                    <p class="text-gray-500 mb-1">关联流程</p>
                    <p class="text-gray-800 font-medium">{docData().workflowName}</p>
                  </div>
                  <div>
                    <p class="text-gray-500 mb-1">创建时间</p>
                    <p class="text-gray-800">{formatTime(docData().createdAt)}</p>
                  </div>
                  <div>
                    <p class="text-gray-500 mb-1">更新时间</p>
                    <p class="text-gray-800">{formatTime(docData().updatedAt)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div class="flex gap-3">
                <A
                  href={`/documents/${params.id}/versions`}
                  class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  查看版本历史
                </A>
                <A
                  href={`/projects/${docData().projectId}`}
                  class="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  返回项目
                </A>
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
