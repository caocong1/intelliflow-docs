type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export default function Pagination(props: PaginationProps) {
  const totalPages = () => Math.max(1, Math.ceil(props.total / props.pageSize));
  const isFirstPage = () => props.page <= 1;
  const isLastPage = () => props.page >= totalPages();

  return (
    <div class="flex items-center justify-between px-4 py-3">
      <span class="text-sm text-slate-500">
        {props.total > 0
          ? `共 ${props.total} 条，第 ${(props.page - 1) * props.pageSize + 1}–${Math.min(props.page * props.pageSize, props.total)} 条`
          : "暂无数据"}
      </span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          onClick={() => props.onPageChange(props.page - 1)}
          disabled={isFirstPage()}
          class="px-3 py-1.5 text-sm border border-slate-200 rounded-lg transition-colors cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          上一页
        </button>
        <span class="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg">
          {props.page}
        </span>
        <span class="text-sm text-slate-400">/ {totalPages()}</span>
        <button
          type="button"
          onClick={() => props.onPageChange(props.page + 1)}
          disabled={isLastPage()}
          class="px-3 py-1.5 text-sm border border-slate-200 rounded-lg transition-colors cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
