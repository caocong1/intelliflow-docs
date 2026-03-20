import { createSignal, For, onMount, Show } from "solid-js";
import { api } from "../../api/client";
import Modal from "../ui/Modal";

type MemberItem = {
  userId: string;
  displayName: string;
  username: string;
};

type MemberSelectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentMemberIds: string[];
  onConfirm: (selectedIds: string[]) => void;
};

export default function MemberSelectModal(props: MemberSelectModalProps) {
  const [members, setMembers] = createSignal<MemberItem[]>([]);
  const [selected, setSelected] = createSignal<Set<string>>(new Set());
  const [loading, setLoading] = createSignal(false);

  async function fetchMembers() {
    setLoading(true);
    try {
      const { data, error } = await api.api.projects({ id: props.projectId }).members.get();
      if (error) return;
      const list = data as unknown as MemberItem[];
      setMembers(list);
      // Initialize selection from currentMemberIds
      setSelected(new Set(props.currentMemberIds));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Re-fetch when modal opens
  const handleOpen = () => {
    if (props.isOpen) {
      fetchMembers();
    }
  };

  // Watch isOpen changes
  onMount(() => {
    handleOpen();
  });

  // Use a reactive effect to re-fetch when isOpen changes
  const isOpenAccessor = () => {
    if (props.isOpen) {
      fetchMembers();
    }
    return props.isOpen;
  };

  function toggleMember(userId: string) {
    const current = new Set(selected());
    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
    }
    setSelected(current);
  }

  function handleConfirm() {
    props.onConfirm(Array.from(selected()));
  }

  return (
    <Show when={isOpenAccessor()}>
      <Modal isOpen={props.isOpen} onClose={props.onClose} title="选择可见成员">
        <div class="space-y-3">
          <Show when={loading()}>
            <div class="flex items-center justify-center py-6">
              <div class="w-6 h-6 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          </Show>

          <Show when={!loading()}>
            <Show when={members().length === 0}>
              <p class="text-sm text-slate-400 text-center py-4">暂无项目成员</p>
            </Show>

            <div class="max-h-64 overflow-y-auto space-y-1">
              <For each={members()}>
                {(member) => (
                  <label
                    class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-indigo-50/50 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected().has(member.userId)}
                      onChange={() => toggleMember(member.userId)}
                      class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div class="flex-1 min-w-0">
                      <span class="text-sm font-medium text-slate-700">{member.displayName}</span>
                      <span class="text-xs text-slate-400 ml-2">@{member.username}</span>
                    </div>
                  </label>
                )}
              </For>
            </div>
          </Show>

          <div class="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              class="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              确认 ({selected().size})
            </button>
          </div>
        </div>
      </Modal>
    </Show>
  );
}
