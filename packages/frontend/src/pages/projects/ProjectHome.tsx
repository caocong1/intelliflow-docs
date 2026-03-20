import { A, useParams } from "@solidjs/router";
import { createSignal, onMount, Show } from "solid-js";
import { api } from "../../api/client";
import { useAuth } from "../../contexts/auth";
import { showToast } from "../../components/ui/Toast";

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  createdBy: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export default function ProjectHome() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const [project, setProject] = createSignal<ProjectDetail | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [notFound, setNotFound] = createSignal(false);

  async function fetchProject() {
    setLoading(true);
    try {
      const { data, error } = await api.api.projects({ id: params.id }).get();
      if (error) {
        setNotFound(true);
        return;
      }
      setProject(data as unknown as ProjectDetail);
    } catch {
      showToast("网络错误，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(fetchProject);

  const isOwner = () => project()?.createdBy === auth.user()?.id;

  return (
    <div class="p-6">
      <Show when={loading()}>
        <div class="flex items-center justify-center py-20">
          <div class="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={notFound() && !loading()}>
        <div class="text-center py-20">
          <p class="text-slate-500 text-sm">项目不存在或已被删除</p>
          <A href="/projects" class="text-sm text-indigo-600 hover:text-indigo-800 mt-2 inline-block cursor-pointer">
            返回项目列表
          </A>
        </div>
      </Show>

      <Show when={project() && !loading()}>
        {/* Breadcrumb */}
        <div class="flex items-center gap-2 text-sm text-slate-500 mb-4">
          <A href="/projects" class="hover:text-indigo-600 cursor-pointer transition-colors">
            项目列表
          </A>
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>分隔</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span class="text-slate-700 font-medium">{project()!.name}</span>
        </div>

        {/* Project info bar */}
        <div class="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <div class="flex items-start justify-between">
            <div>
              <h1 class="text-xl font-bold text-indigo-950">{project()!.name}</h1>
              <Show when={project()!.description}>
                <p class="text-sm text-slate-500 mt-1">{project()!.description}</p>
              </Show>
              <div class="flex items-center gap-4 mt-3 text-sm text-slate-400">
                <Show when={project()!.department}>
                  <span class="flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <title>部门</title>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {project()!.department}
                  </span>
                </Show>
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <title>成员</title>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  {project()!.memberCount} 名成员
                </span>
              </div>
            </div>

            <Show when={isOwner()}>
              <A
                href={`/projects/${params.id}/settings`}
                class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="项目设置"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <title>设置</title>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </A>
            </Show>
          </div>
        </div>

        {/* Document list placeholder */}
        <div class="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <svg class="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <title>文档</title>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-sm text-slate-400">文档列表将在后续计划中实现</p>
        </div>
      </Show>
    </div>
  );
}
