import { NextRequest } from "next/server";

export function parsePagination(request: NextRequest, defaults?: { page?: number; pageSize?: number; maxPageSize?: number }) {
  const page = Number(request.nextUrl.searchParams.get("page") ?? defaults?.page ?? 1);
  const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? defaults?.pageSize ?? 20);
  const maxPageSize = defaults?.maxPageSize ?? 100;

  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const safePageSize = Number.isFinite(pageSize)
    ? Math.min(maxPageSize, Math.max(1, Math.floor(pageSize)))
    : defaults?.pageSize ?? 20;

  const skip = (safePage - 1) * safePageSize;

  return {
    page: safePage,
    pageSize: safePageSize,
    skip,
    take: safePageSize
  };
}
