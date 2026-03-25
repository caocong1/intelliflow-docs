import { For, Show, createEffect, createSignal } from "solid-js";
import { api } from "../../api/client";

type WecomDepartment = {
  id: number;
  name: string;
  name_en: string;
  parentid: number;
  order: number;
};

type WecomMember = {
  userid: string;
  name: string;
  department: number[];
  position: string;
  avatar: string;
  status: number;
};

type SelectedMember = {
  userid: string;
  name: string;
};

interface WecomMemberPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (members: SelectedMember[]) => void;
  submitting?: boolean;
}

export default function WecomMemberPicker(props: WecomMemberPickerProps) {
  const [departments, setDepartments] = createSignal<WecomDepartment[]>([]);
  const [members, setMembers] = createSignal<WecomMember[]>([]);
  const [selectedDeptId, setSelectedDeptId] = createSignal<number | null>(null);
  const [selected, setSelected] = createSignal<Map<string, SelectedMember>>(new Map());
  const [deptLoading, setDeptLoading] = createSignal(false);
  const [memberLoading, setMemberLoading] = createSignal(false);

  createEffect(() => {
    if (props.isOpen) {
      fetchDepartments();
      setSelected(new Map());
      setMembers([]);
      setSelectedDeptId(null);
    }
  });

  async function fetchDepartments() {
    setDeptLoading(true);
    try {
      const { data } = await api.api.wecom.departments.get();
      const result = data as unknown as { departments: WecomDepartment[] };
      setDepartments(result.departments ?? []);
    } catch {
      // ignore
    } finally {
      setDeptLoading(false);
    }
  }

  async function fetchMembers(deptId: number) {
    setMemberLoading(true);
    setSelectedDeptId(deptId);
    try {
      const { data } = await api.api.wecom.members({ departmentId: String(deptId) }).get();
      const result = data as unknown as { members: WecomMember[] };
      setMembers(result.members ?? []);
    } catch {
      setMembers([]);
    } finally {
      setMemberLoading(false);
    }
  }

  function toggleMember(member: WecomMember) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(member.userid)) {
        next.delete(member.userid);
      } else {
        next.set(member.userid, { userid: member.userid, name: member.name });
      }
      return next;
    });
  }

  function removeMember(userid: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(userid);
      return next;
    });
  }

  function handleConfirm() {
    props.onConfirm(Array.from(selected().values()));
  }

  // Build department tree
  function buildTree(parentId: number): WecomDepartment[] {
    return departments()
      .filter((d) => d.parentid === parentId)
      .sort((a, b) => b.order - a.order);
  }

  function DeptNode(dept: WecomDepartment, level: number) {
    const children = buildTree(dept.id);
    const isActive = () => selectedDeptId() === dept.id;

    return (
      <div>
        <button
          type="button"
          class={`w-full text-left px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${
            isActive() ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700 hover:bg-slate-50"
          }`}
          style={{ "padding-left": `${level * 16 + 12}px` }}
          onClick={() => fetchMembers(dept.id)}
        >
          <span class="flex items-center gap-1.5">
            <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <title>部门</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {dept.name}
          </span>
        </button>
        <Show when={children.length > 0}>
          <For each={children}>{(child) => DeptNode(child, level + 1)}</For>
        </Show>
      </div>
    );
  }

  return (
    <Show when={props.isOpen}>
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/40" onClick={props.onClose} />

      {/* Dialog */}
      <div class="relative bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 flex flex-col" style={{ "max-height": "80vh" }}>
        {/* Header */}
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 class="text-lg font-semibold text-slate-900">从企业微信选择成员</h3>
          <button type="button" onClick={props.onClose} class="text-slate-400 hover:text-slate-600 cursor-pointer">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <title>关闭</title>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div class="flex flex-1 overflow-hidden">
          {/* Left: Department tree */}
          <div class="w-56 border-r border-slate-200 overflow-y-auto p-2 flex-shrink-0">
            <Show when={deptLoading()}>
              <div class="flex items-center justify-center py-8 text-sm text-slate-400">加载部门...</div>
            </Show>
            <Show when={!deptLoading()}>
              <For each={buildTree(0)}>
                {(dept) => DeptNode(dept, 0)}
              </For>
              {/* If no root departments found (parentid=0), try parentid=1 */}
              <Show when={buildTree(0).length === 0}>
                <For each={departments().sort((a, b) => a.parentid - b.parentid)}>
                  {(dept) => (
                    <button
                      type="button"
                      class={`w-full text-left px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${
                        selectedDeptId() === dept.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                      }`}
                      onClick={() => fetchMembers(dept.id)}
                    >
                      {dept.name}
                    </button>
                  )}
                </For>
              </Show>
            </Show>
          </div>

          {/* Right: Member list */}
          <div class="flex-1 overflow-y-auto p-4">
            <Show when={!selectedDeptId()}>
              <div class="flex items-center justify-center h-full text-sm text-slate-400">请选择左侧部门</div>
            </Show>
            <Show when={memberLoading()}>
              <div class="flex items-center justify-center py-8 text-sm text-slate-400">加载成员...</div>
            </Show>
            <Show when={selectedDeptId() && !memberLoading()}>
              <Show when={members().length === 0}>
                <div class="text-sm text-slate-400 text-center py-8">该部门暂无成员</div>
              </Show>
              <div class="space-y-1">
                <For each={members()}>
                  {(member) => {
                    const isSelected = () => selected().has(member.userid);
                    return (
                      <button
                        type="button"
                        class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                          isSelected() ? "bg-indigo-50 border border-indigo-200" : "hover:bg-slate-50 border border-transparent"
                        }`}
                        onClick={() => toggleMember(member)}
                      >
                        {/* Checkbox */}
                        <div class={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isSelected() ? "bg-indigo-600 border-indigo-600" : "border-slate-300"
                        }`}>
                          <Show when={isSelected()}>
                            <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <title>已选</title>
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </Show>
                        </div>
                        {/* Avatar */}
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} class="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {member.name.slice(0, 1)}
                          </div>
                        )}
                        <div class="text-left min-w-0 flex-1">
                          <p class="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                          <Show when={member.position}>
                            <p class="text-xs text-slate-500 truncate">{member.position}</p>
                          </Show>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </div>

        {/* Selected tags */}
        <Show when={selected().size > 0}>
          <div class="px-6 py-3 border-t border-slate-200 bg-slate-50">
            <p class="text-xs text-slate-500 mb-2">已选择 {selected().size} 人</p>
            <div class="flex flex-wrap gap-1.5">
              <For each={Array.from(selected().values())}>
                {(m) => (
                  <span class="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-md">
                    {m.name}
                    <button
                      type="button"
                      class="text-indigo-400 hover:text-indigo-600 cursor-pointer"
                      onClick={() => removeMember(m.userid)}
                    >
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <title>移除</title>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Footer */}
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={props.onClose}
            class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={selected().size === 0 || props.submitting}
            onClick={handleConfirm}
            class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {props.submitting ? "发送中..." : `发送邀请 (${selected().size})`}
          </button>
        </div>
      </div>
    </div>
    </Show>
  );
}
