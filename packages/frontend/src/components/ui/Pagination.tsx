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
      <span class="text-sm text-gray-500">
        {props.total > 0
          ? `${(props.page - 1) * props.pageSize + 1}-${Math.min(props.page * props.pageSize, props.total)} / ${props.total}`
          : "0 items"}
      </span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          onClick={() => props.onPageChange(props.page - 1)}
          disabled={isFirstPage()}
          class="px-3 py-1.5 text-sm border border-gray-300 rounded-md transition-colors cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Previous
        </button>
        <span class="text-sm text-gray-700">
          {props.page} / {totalPages()}
        </span>
        <button
          type="button"
          onClick={() => props.onPageChange(props.page + 1)}
          disabled={isLastPage()}
          class="px-3 py-1.5 text-sm border border-gray-300 rounded-md transition-colors cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Next
        </button>
      </div>
    </div>
  );
}
