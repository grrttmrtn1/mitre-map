import type { Request } from 'express';

export interface PageOptions {
  paginated: boolean;
  limit: number;
  offset: number;
  search: string;
}

/** Common, bounded pagination contract. Existing callers stay unpaged unless requested. */
export function pageOptions(req: Request, defaultLimit = 50): PageOptions {
  const paginated = req.query.paginated === 'true' || req.query.limit !== undefined || req.query.offset !== undefined;
  const parsedLimit = Number(req.query.limit ?? defaultLimit);
  const parsedOffset = Number(req.query.offset ?? 0);
  return {
    paginated,
    limit: Number.isFinite(parsedLimit) ? Math.max(1, Math.min(250, Math.floor(parsedLimit))) : defaultLimit,
    offset: Number.isFinite(parsedOffset) ? Math.max(0, Math.floor(parsedOffset)) : 0,
    search: String(req.query.search ?? '').trim().slice(0, 200),
  };
}

export function pageResult<T>(rows: T[], total: number, limit: number, offset: number) {
  const nextOffset = offset + rows.length;
  return { rows, total, limit, offset, next_offset: nextOffset < total ? nextOffset : null };
}
