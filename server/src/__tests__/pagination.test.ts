import { describe, expect, it } from 'vitest';
import { pageOptions, pageResult } from '../lib/pagination';

const req = (query: Record<string, unknown>) => ({ query }) as any;

describe('pagination contract', () => {
  it('is backward compatible unless pagination is requested', () => {
    expect(pageOptions(req({})).paginated).toBe(false);
    expect(pageOptions(req({ paginated: 'true' })).paginated).toBe(true);
  });
  it('bounds untrusted limit and offset values', () => {
    expect(pageOptions(req({ limit: '99999', offset: '-3' }))).toMatchObject({ limit: 250, offset: 0 });
  });
  it('returns a next offset only when more rows exist', () => {
    expect(pageResult([1, 2], 5, 2, 0).next_offset).toBe(2);
    expect(pageResult([1], 1, 10, 0).next_offset).toBeNull();
  });
});
