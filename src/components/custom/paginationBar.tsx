import { Paginated } from "@/types/download";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

export default function PaginationBar({
    paginatedData,
    setPage,
}: {
    paginatedData: Paginated;
    setPage: (page: number) => void;
}) {
    return (
        <Pagination className="mt-4">
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        onClick={() => setPage(paginatedData.prev_page ?? paginatedData.first_page)}
                        aria-disabled={!paginatedData.prev_page}
                        className={!paginatedData.prev_page ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                </PaginationItem>

                {paginatedData.pages.map((link, index, array) => {
                    const currentPage = paginatedData.current_page;
                    const pageNumber = link.page!;

                    // Show first page, last page, current page, and 2 pages around current
                    const showPage =
                        pageNumber === 1 ||
                        pageNumber === paginatedData.last_page ||
                        Math.abs(pageNumber - currentPage) <= 1;

                    // Show ellipsis if there's a gap
                    const prevVisiblePage = array
                        .slice(0, index)
                        .reverse()
                        .find((prevLink) => {
                            const prevPageNum = prevLink.page!;
                            return (
                                prevPageNum === 1 ||
                                prevPageNum === paginatedData.last_page ||
                                Math.abs(prevPageNum - currentPage) <= 1
                            );
                        })?.page;

                    const showEllipsis = showPage && prevVisiblePage && pageNumber - prevVisiblePage > 1;

                    if (!showPage) return null;

                    return (
                        <div key={link.page} className="contents">
                            {showEllipsis && (
                                <PaginationItem>
                                    <PaginationEllipsis />
                                </PaginationItem>
                            )}
                            {showPage && (
                                <PaginationItem>
                                    <PaginationLink
                                        className="cursor-pointer"
                                        onClick={() => setPage(link.page)}
                                        isActive={link.active}
                                    >
                                        {link.label}
                                    </PaginationLink>
                                </PaginationItem>
                            )}
                        </div>
                    );
                })}

                <PaginationItem>
                    <PaginationNext
                        onClick={() => setPage(paginatedData.next_page ?? paginatedData.last_page)}
                        aria-disabled={!paginatedData.next_page}
                        className={!paginatedData.next_page ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    )
}
