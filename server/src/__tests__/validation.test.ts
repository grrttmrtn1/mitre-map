import { describe, expect, it, vi } from 'vitest';
import { validateBody } from '../middleware/validation';

function run(body: unknown, schema: Parameters<typeof validateBody>[0], rejectUnknown = true) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const next = vi.fn();
  validateBody(schema, { rejectUnknown })({ body } as any, { status } as any, next);
  return { status, json, next };
}

const schema = {
  name: { type: 'string', required: true, minLength: 2, maxLength: 10 },
  role: { type: 'string', enum: ['admin', 'analyst'] },
  tags: { type: 'array', itemType: 'string' },
} as const;

describe('validateBody', () => {
  it('accepts a valid body', () => {
    const result = run({ name: 'Alice', role: 'analyst', tags: ['one'] }, schema);
    expect(result.next).toHaveBeenCalledOnce();
    expect(result.status).not.toHaveBeenCalled();
  });

  it('rejects missing, unknown, invalid enum, and invalid array fields', () => {
    expect(run({}, schema).status).toHaveBeenCalledWith(400);
    expect(run({ name: 'Alice', extra: true }, schema).status).toHaveBeenCalledWith(400);
    expect(run({ name: 'Alice', role: 'owner' }, schema).status).toHaveBeenCalledWith(400);
    expect(run({ name: 'Alice', tags: [1] }, schema).status).toHaveBeenCalledWith(400);
  });

  it('rejects non-object bodies and string bounds', () => {
    expect(run([], schema).status).toHaveBeenCalledWith(400);
    expect(run({ name: 'A' }, schema).status).toHaveBeenCalledWith(400);
    expect(run({ name: 'A very long name' }, schema).status).toHaveBeenCalledWith(400);
  });
});
