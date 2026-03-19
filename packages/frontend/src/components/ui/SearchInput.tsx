import { createSignal, onCleanup } from "solid-js";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function SearchInput(props: SearchInputProps) {
  const [local, setLocal] = createSignal(props.value);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const handleInput = (value: string) => {
    setLocal(value);
    clearTimeout(timer);
    timer = setTimeout(() => {
      props.onChange(value);
    }, 300);
  };

  const handleClear = () => {
    setLocal("");
    clearTimeout(timer);
    props.onChange("");
  };

  onCleanup(() => clearTimeout(timer));

  return (
    <div class="relative">
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <title>搜索</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={local()}
        onInput={(e) => handleInput(e.currentTarget.value)}
        placeholder={props.placeholder ?? "搜索..."}
        class="w-full pl-10 pr-8 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
      />
      {local() && (
        <button
          type="button"
          onClick={handleClear}
          class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none"
          aria-label="清除搜索"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <title>清除</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
