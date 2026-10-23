interface PaginationProps {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    pageSizeOptions?: number[];
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
}

export default function Pagination({
    page,
    pageSize,
    totalCount,
    totalPages,
    pageSizeOptions = [10, 25, 50, 100],
    onPageChange,
    onPageSizeChange,
}: PaginationProps) {
    const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, totalCount);

    return (
        <nav className="pagination" aria-label="Pagination">
            <span>
                Showing {from}–{to} of {totalCount}
            </span>
            <div className="pagination-controls">
                <label>
                    Rows per page{' '}
                    <select
                        className="filter-select"
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    >
                        {pageSizeOptions.map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
                    Previous
                </button>
                <span>
                    Page {page} of {Math.max(totalPages, 1)}
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
                    Next
                </button>
            </div>
        </nav>
    );
}