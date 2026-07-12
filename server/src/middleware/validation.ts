import type { NextFunction, Request, Response } from 'express';

type Rule = {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  enum?: readonly unknown[];
  itemType?: 'string' | 'number';
  min?: number;
  max?: number;
  pattern?: RegExp;
  format?: 'email' | 'url' | 'date-time';
  minItems?: number;
  maxItems?: number;
};

export type BodySchema = Record<string, Rule>;

/** Lightweight boundary validation for JSON APIs without runtime dependencies. */
export function validateBody(schema: BodySchema, options: { rejectUnknown?: boolean } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    if (options.rejectUnknown) {
      const unknown = Object.keys(req.body).find(key => !(key in schema));
      if (unknown) return res.status(400).json({ error: `Unknown field: ${unknown}`, field: unknown });
    }
    for (const [field, rule] of Object.entries(schema)) {
      const value = req.body[field];
      if (value === undefined || value === null) {
        if (rule.required) return res.status(400).json({ error: `${field} is required`, field });
        continue;
      }
      const validType = rule.type === 'array' ? Array.isArray(value) : typeof value === rule.type;
      if (!validType) return res.status(400).json({ error: `${field} must be a ${rule.type}`, field });
      if (typeof value === 'string') {
        if (rule.minLength !== undefined && value.trim().length < rule.minLength) return res.status(400).json({ error: `${field} is too short`, field });
        if (rule.maxLength !== undefined && value.length > rule.maxLength) return res.status(400).json({ error: `${field} is too long`, field });
        if (rule.pattern && !rule.pattern.test(value)) return res.status(400).json({ error: `${field} has an invalid format`, field });
        if (rule.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return res.status(400).json({ error: `${field} must be a valid email address`, field });
        if (rule.format === 'url') {
          try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
          catch { return res.status(400).json({ error: `${field} must be a valid HTTP(S) URL`, field }); }
        }
        if (rule.format === 'date-time' && Number.isNaN(Date.parse(value))) return res.status(400).json({ error: `${field} must be a valid date-time`, field });
      }
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) return res.status(400).json({ error: `${field} must be finite`, field });
        if (rule.min !== undefined && value < rule.min) return res.status(400).json({ error: `${field} must be at least ${rule.min}`, field });
        if (rule.max !== undefined && value > rule.max) return res.status(400).json({ error: `${field} must be at most ${rule.max}`, field });
      }
      if (rule.enum && !rule.enum.includes(value)) return res.status(400).json({ error: `${field} has an invalid value`, field });
      if (Array.isArray(value) && rule.itemType && value.some(item => typeof item !== rule.itemType)) {
        return res.status(400).json({ error: `${field} must contain only ${rule.itemType} values`, field });
      }
      if (Array.isArray(value) && rule.minItems !== undefined && value.length < rule.minItems) return res.status(400).json({ error: `${field} must contain at least ${rule.minItems} item(s)`, field });
      if (Array.isArray(value) && rule.maxItems !== undefined && value.length > rule.maxItems) return res.status(400).json({ error: `${field} must contain at most ${rule.maxItems} item(s)`, field });
    }
    next();
  };
}
