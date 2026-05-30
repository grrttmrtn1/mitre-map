# Foundation: Search, Navigation & Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global Cmd+K command palette, in-app notification center, quick-action shortcuts (create detection from gap, assign gap, add to exercise), and breadcrumb navigation.

**Architecture:** Notifications are stored server-side in a new `notifications` table with per-user rows. The command palette searches cached entity data client-side. Quick actions use existing API endpoints (/api/detections, /api/assignments, /api/exercises) pre-populated via URL params or inline forms.

**Tech Stack:** Express route (notifications), Knex migration, React context (NotificationContext), React portal (CommandPalette), Lucide icons, React Router useNavigate/useSearchParams.

---

## File Map

| File | Action |
|------|--------|
| `server/src/db/migrations/016_notifications.ts` | Create — notifications table |
| `server/src/db/database.ts` | Modify — add `createNotification`, `createNotificationsForAllAnalysts` |
| `server/src/routes/notifications.ts` | Create — CRUD route |
| `server/src/index.ts` | Modify — register notifications router |
| `server/src/routes/taxii.ts` | Modify — trigger notification on batch creation |
| `server/src/routes/attack.ts` | Modify — trigger notification after deprecated scan |
| `server/src/__tests__/helpers/testDb.ts` | Modify — add notifications table |
| `server/src/__tests__/notifications.test.ts` | Create — route tests |
| `client/src/types.ts` | Modify — add Notification type |
| `client/src/api.ts` | Modify — add notification API calls |
| `client/src/context/NotificationContext.tsx` | Create — state + polling |
| `client/src/components/NotificationCenter.tsx` | Create — bell icon + dropdown |
| `client/src/components/CommandPalette.tsx` | Create — Cmd+K search modal |
| `client/src/components/Breadcrumb.tsx` | Create — breadcrumb component |
| `client/src/App.tsx` | Modify — mount CommandPalette, NotificationProvider |
| `client/src/components/Sidebar.tsx` | Modify — add NotificationCenter |
| `client/src/pages/GapAnalysis.tsx` | Modify — "Create Detection from Gap" + "Assign this gap" |
| `client/src/pages/Prioritization.tsx` | Modify — "Assign to self" |
| `client/src/pages/AttackMatrix.tsx` | Modify — "Add to Exercise" |
| `client/src/pages/Detections.tsx` | Modify — read prefill params from URL |

---

### Task 1: Notifications DB Migration

**Files:**
- Create: `server/src/db/migrations/016_notifications.ts`

- [ ] **Step 1: Create migration file**

```typescript
// server/src/db/migrations/016_notifications.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTableIfNotExists('notifications', t => {
    t.increments('id').primary();
    t.integer('user_id').nullable(); // null = all active analysts see it
    t.string('type').notNullable();  // taxii_batch_ready | deprecated_technique | assignment_due | coverage_alert
    t.string('title').notNullable();
    t.text('message').nullable();
    t.string('entity_type').nullable(); // taxii_batch | detection | assignment
    t.string('entity_id').nullable();
    t.integer('read').notNullable().defaultTo(0);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
}
```

- [ ] **Step 2: Run migration to verify it applies cleanly**

```bash
cd server && npm run migrate
```
Expected: `Batch 14 run: 1 migrations`

- [ ] **Step 3: Commit**

```bash
git add server/src/db/migrations/016_notifications.ts
git commit -m "feat: add notifications table migration"
```

---

### Task 2: createNotification helpers in database.ts

**Files:**
- Modify: `server/src/db/database.ts`

- [ ] **Step 1: Add helpers at the bottom of database.ts**

```typescript
// Add after logAudit():

export async function createNotification(
  db: DB,
  opts: {
    user_id?: number | null;
    type: string;
    title: string;
    message?: string;
    entity_type?: string;
    entity_id?: string;
  }
): Promise<void> {
  await db.raw(
    'INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)',
    [opts.user_id ?? null, opts.type, opts.title, opts.message ?? null, opts.entity_type ?? null, opts.entity_id ?? null]
  );
}

export async function createNotificationsForAllAnalysts(
  db: DB,
  opts: { type: string; title: string; message?: string; entity_type?: string; entity_id?: string }
): Promise<void> {
  const users = await rawAll<{ id: number }>(
    db,
    "SELECT id FROM users WHERE role IN ('admin', 'analyst') AND is_active = 1"
  );
  // If no users exist (bootstrap mode), skip — nobody to notify
  for (const user of users) {
    await createNotification(db, { ...opts, user_id: user.id });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/db/database.ts
git commit -m "feat: add createNotification helpers to database.ts"
```

---

### Task 3: Notifications route

**Files:**
- Create: `server/src/routes/notifications.ts`

- [ ] **Step 1: Create the route**

```typescript
// server/src/routes/notifications.ts
import { Router } from 'express';
import { getKnex, rawAll, rawRun } from '../db/database';

const router = Router();

// GET /api/notifications — unread notifications for current user
router.get('/', async (req, res) => {
  const db = getKnex();
  const userId = (req as any).userId ?? null;
  const rows = await rawAll(
    db,
    `SELECT * FROM notifications
     WHERE (user_id IS NULL OR user_id = ?) AND read = 0
     ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  res.json(rows);
});

// PATCH /api/notifications/read-all — must be before /:id route
router.patch('/read-all', async (req, res) => {
  const db = getKnex();
  const userId = (req as any).userId ?? null;
  await rawRun(
    db,
    'UPDATE notifications SET read = 1 WHERE user_id = ? OR user_id IS NULL',
    [userId]
  );
  res.status(204).end();
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  const db = getKnex();
  await rawRun(db, 'UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

export default router;
```

- [ ] **Step 2: Register router in index.ts**

In `server/src/index.ts`, add after the imports block:
```typescript
import notificationsRouter from './routes/notifications';
```

And after `app.use('/api/prioritization', prioritizationRouter);`:
```typescript
app.use('/api/notifications', notificationsRouter);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/notifications.ts server/src/index.ts
git commit -m "feat: add notifications route"
```

---

### Task 4: Add notifications table to test helper + write tests

**Files:**
- Modify: `server/src/__tests__/helpers/testDb.ts`
- Create: `server/src/__tests__/notifications.test.ts`

- [ ] **Step 1: Add notifications table to setupTestDb in testDb.ts**

In `server/src/__tests__/helpers/testDb.ts`, inside the `setupTestDb` function, at the end of the chained `.createTableIfNotExists` calls before the final semicolon:

```typescript
    .createTableIfNotExists('notifications', t => {
      t.increments('id').primary();
      t.integer('user_id').nullable();
      t.string('type').notNullable();
      t.string('title').notNullable();
      t.text('message').nullable();
      t.string('entity_type').nullable();
      t.string('entity_id').nullable();
      t.integer('read').notNullable().defaultTo(0);
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
```

- [ ] **Step 2: Write the test file**

```typescript
// server/src/__tests__/notifications.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import notificationsRouter from '../routes/notifications';
import { createNotification } from '../db/database';
import type { Knex as KnexType } from 'knex';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  // Patch getKnex to return test DB
  const dbModule = await import('../db/database');
  (dbModule as any)._instance = db;
  app = createTestApp(['/api/notifications', notificationsRouter]);
});

afterAll(async () => {
  await db.destroy();
});

describe('GET /api/notifications', () => {
  it('returns empty array when no notifications', async () => {
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toEqual([]);
  });

  it('returns unread notifications for user_id null (global)', async () => {
    await createNotification(db, { user_id: null, type: 'taxii_batch_ready', title: 'Batch ready', message: '3 items' });
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Batch ready');
    expect(res.body[0].read).toBe(0);
  });

  it('does not return already-read notifications', async () => {
    await db.raw('UPDATE notifications SET read = 1');
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('PATCH /api/notifications/read-all', () => {
  it('marks all notifications as read', async () => {
    await db.raw('UPDATE notifications SET read = 0');
    await request(app).patch('/api/notifications/read-all').expect(204);
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks a single notification as read', async () => {
    await db.raw('UPDATE notifications SET read = 0');
    const rows = await db.raw('SELECT id FROM notifications LIMIT 1');
    const id = rows[0]?.id;
    if (!id) return; // skip if no notifications
    await request(app).patch(`/api/notifications/${id}/read`).expect(204);
    const after = await db.raw('SELECT read FROM notifications WHERE id = ?', [id]);
    expect(after[0].read).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd server && npm test -- notifications
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/__tests__/helpers/testDb.ts server/src/__tests__/notifications.test.ts
git commit -m "test: add notification tests"
```

---

### Task 5: Trigger notifications from TAXII and ATT&CK routes

**Files:**
- Modify: `server/src/routes/taxii.ts`
- Modify: `server/src/routes/attack.ts`

- [ ] **Step 1: Add notification trigger in taxii.ts after batch creation**

In `server/src/routes/taxii.ts`, add import at top:
```typescript
import { createNotificationsForAllAnalysts } from '../db/database';
```

Find the `POST /api/taxii/servers/:id/fetch` handler where a batch is created. After `await rawInsert(db, 'INSERT INTO taxii_pending_ingests ...')` (or after the batch_id is assigned), add:
```typescript
await createNotificationsForAllAnalysts(db, {
  type: 'taxii_batch_ready',
  title: 'TAXII batch ready for review',
  message: `${pendingCount} items staged from ${server.name}`,
  entity_type: 'taxii_batch',
  entity_id: String(batchId),
}).catch(() => {}); // Non-blocking — don't fail the fetch if notification fails
```

- [ ] **Step 2: Add notification trigger in attack.ts after migration scan**

In `server/src/routes/attack.ts`, add import:
```typescript
import { createNotificationsForAllAnalysts } from '../db/database';
```

Find the `GET /api/attack/migration-scan` handler. After building the results array, if `results.length > 0`, add:
```typescript
if (results.length > 0) {
  await createNotificationsForAllAnalysts(db, {
    type: 'deprecated_technique',
    title: `${results.length} detection(s) reference deprecated techniques`,
    message: 'Run Migration Scan in Settings to review affected detections.',
    entity_type: 'detection',
  }).catch(() => {});
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/taxii.ts server/src/routes/attack.ts
git commit -m "feat: trigger notifications on TAXII batch and deprecated technique scan"
```

---

### Task 6: Frontend types and API client

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`

- [ ] **Step 1: Add Notification type to types.ts**

```typescript
// Add to client/src/types.ts:
export interface Notification {
  id: number;
  user_id: number | null;
  type: 'taxii_batch_ready' | 'deprecated_technique' | 'assignment_due' | 'coverage_alert';
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read: number;
  created_at: string;
}
```

- [ ] **Step 2: Add notification API calls to api.ts**

Add `Notification` to the import at the top of `client/src/api.ts`:
```typescript
import type { ..., Notification } from './types';
```

Add after the last export in the `api` object:
```typescript
  getNotifications: () => get<Notification[]>('/notifications'),
  markNotificationRead: (id: number) => patch<void>(`/notifications/${id}/read`, {}),
  markAllNotificationsRead: () => patch<void>('/notifications/read-all', {}),
```

(The `patch` helper already exists in api.ts — use the existing pattern.)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add client/src/types.ts client/src/api.ts
git commit -m "feat: add Notification type and API client methods"
```

---

### Task 7: NotificationContext

**Files:**
- Create: `client/src/context/NotificationContext.tsx`

- [ ] **Step 1: Create the context**

```typescript
// client/src/context/NotificationContext.tsx
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api } from '../api';
import type { Notification } from '../types';

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [], unreadCount: 0,
  markRead: async () => {}, markAllRead: async () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch { /* not authed yet or server down — silently skip */ }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const markRead = async (id: number) => {
    await api.markNotificationRead(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount: notifications.length, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/context/NotificationContext.tsx
git commit -m "feat: add NotificationContext with 60s polling"
```

---

### Task 8: NotificationCenter component

**Files:**
- Create: `client/src/components/NotificationCenter.tsx`

- [ ] **Step 1: Create the component**

```tsx
// client/src/components/NotificationCenter.tsx
import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

const TYPE_ICONS: Record<string, string> = {
  taxii_batch_ready: '📥',
  deprecated_technique: '⚠️',
  assignment_due: '📋',
  coverage_alert: '🔴',
};

const ENTITY_HREF: Record<string, (id: string | null) => string> = {
  taxii_batch: () => '/taxii',
  detection: () => '/detections',
  assignment: () => '/gaps',
};

export default function NotificationCenter() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = async (n: { id: number; entity_type: string | null; entity_id: string | null }) => {
    await markRead(n.id);
    setOpen(false);
    const href = n.entity_type ? ENTITY_HREF[n.entity_type]?.(n.entity_id) : null;
    if (href) navigate(href);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-1 rounded text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
        title="Notifications"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-8 left-0 w-72 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-slate-600">No new notifications</div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">{n.title}</div>
                      {n.message && (
                        <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 line-clamp-2">{n.message}</div>
                      )}
                      <div className="text-[10px] text-gray-300 dark:text-slate-600 mt-1">
                        {new Date(n.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/NotificationCenter.tsx
git commit -m "feat: add NotificationCenter component"
```

---

### Task 9: CommandPalette component

**Files:**
- Create: `client/src/components/CommandPalette.tsx`

- [ ] **Step 1: Create the component**

```tsx
// client/src/components/CommandPalette.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api';

interface SearchResult {
  type: 'detection' | 'technique' | 'threat_group' | 'exercise' | 'tool';
  id: string | number;
  name: string;
  href: string;
  subtitle?: string;
}

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  detection: 'Detection',
  technique: 'Technique',
  threat_group: 'Threat Group',
  exercise: 'Exercise',
  tool: 'Tool',
};

const TYPE_COLORS: Record<SearchResult['type'], string> = {
  detection: 'bg-blue-500/10 text-blue-400',
  technique: 'bg-purple-500/10 text-purple-400',
  threat_group: 'bg-red-500/10 text-red-400',
  exercise: 'bg-orange-500/10 text-orange-400',
  tool: 'bg-emerald-500/10 text-emerald-400',
};

let _cache: SearchResult[] | null = null;

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Load searchable entities once
  const loadCache = useCallback(async () => {
    if (_cache) return _cache;
    setLoading(true);
    try {
      const [detections, techniques, groups, exercises, tools] = await Promise.all([
        api.getDetections().catch(() => []),
        api.getTechniques({ include_subtechniques: true }).catch(() => []),
        api.getThreatGroups().catch(() => []),
        api.getExercises().catch(() => []),
        api.getTools().catch(() => []),
      ]);
      _cache = [
        ...detections.map((d: any) => ({
          type: 'detection' as const, id: d.id, name: d.name,
          href: `/detections`, subtitle: d.source ?? d.status,
        })),
        ...techniques.map((t: any) => ({
          type: 'technique' as const, id: t.id, name: t.name,
          href: `/matrix?technique=${t.id}`, subtitle: t.id,
        })),
        ...groups.map((g: any) => ({
          type: 'threat_group' as const, id: g.id, name: g.name,
          href: `/threats`, subtitle: g.country ?? undefined,
        })),
        ...exercises.map((e: any) => ({
          type: 'exercise' as const, id: e.id, name: e.name,
          href: `/exercises`, subtitle: e.status,
        })),
        ...tools.map((t: any) => ({
          type: 'tool' as const, id: t.id, name: t.name,
          href: `/tools`, subtitle: t.vendor ?? undefined,
        })),
      ];
      return _cache;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    loadCache();
  }, [open, loadCache]);

  useEffect(() => {
    if (!query.trim() || !_cache) { setResults([]); return; }
    const q = query.toLowerCase();
    const matches = _cache.filter(r =>
      r.name.toLowerCase().includes(q) ||
      String(r.id).toLowerCase().includes(q) ||
      r.subtitle?.toLowerCase().includes(q)
    ).slice(0, 12);
    setResults(matches);
    setHighlighted(0);
  }, [query]);

  const navigate_to = (href: string) => {
    navigate(href);
    setOpen(false);
    setQuery('');
    _cache = null; // invalidate cache on navigate so stale data doesn't persist forever
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && results[highlighted]) navigate_to(results[highlighted].href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40 backdrop-blur-sm" onClick={() => { setOpen(false); setQuery(''); }}>
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-800">
          <Search size={16} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search detections, techniques, threat groups…"
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none"
          />
          <kbd className="text-[10px] text-gray-400 dark:text-slate-600 border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {loading && (
          <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-slate-600">Loading…</div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-slate-600">No results for "{query}"</div>
        )}

        {!loading && results.length > 0 && (
          <div className="max-h-72 overflow-y-auto py-1">
            {results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => navigate_to(r.href)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === highlighted ? 'bg-blue-500/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${TYPE_COLORS[r.type]}`}>
                  {TYPE_LABELS[r.type]}
                </span>
                <span className="flex-1 text-sm text-gray-800 dark:text-slate-200 truncate">{r.name}</span>
                {r.subtitle && <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">{r.subtitle}</span>}
              </button>
            ))}
          </div>
        )}

        {!query && (
          <div className="px-4 py-4 text-xs text-gray-400 dark:text-slate-600">
            Search across detections, techniques, threat groups, exercises, and tools.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/CommandPalette.tsx
git commit -m "feat: add CommandPalette component (Cmd+K)"
```

---

### Task 10: App.tsx and Sidebar integration

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/Sidebar.tsx`

- [ ] **Step 1: Wrap App with NotificationProvider and mount CommandPalette**

In `client/src/App.tsx`, add imports:
```typescript
import { NotificationProvider } from './context/NotificationContext';
import CommandPalette from './components/CommandPalette';
```

Wrap the existing `<ThemeProvider>` tree so NotificationProvider sits inside AuthProvider (needs auth to fetch notifications):
```tsx
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <AppShell />
            <ToastContainer />
            <CommandPalette />
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Add NotificationCenter to Sidebar**

In `client/src/components/Sidebar.tsx`, add import:
```typescript
import NotificationCenter from './NotificationCenter';
```

In the bottom section of the sidebar (near the theme toggle), add `<NotificationCenter />`:
```tsx
<div className="flex items-center justify-between">
  <NotificationCenter />
  <div className="text-xs text-gray-400 dark:text-slate-500">{version} · D3FEND v1</div>
  <button onClick={toggle} ...>
    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
  </button>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx client/src/components/Sidebar.tsx
git commit -m "feat: integrate CommandPalette and NotificationCenter into app shell"
```

---

### Task 11: Quick actions on Gap Analysis

**Files:**
- Modify: `client/src/pages/GapAnalysis.tsx`
- Modify: `client/src/pages/Detections.tsx`

- [ ] **Step 1: Add "Create Detection from Gap" and "Assign this gap" to GapAnalysis.tsx**

In `GapAnalysis.tsx`, add imports:
```tsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
```

Add state for the inline assign form at top of component:
```tsx
const navigate = useNavigate();
const { user } = useAuth();
const { toast } = useToast();
const [assigningGap, setAssigningGap] = useState<string | null>(null); // technique_id
const [assignForm, setAssignForm] = useState({ assignee: '', priority: 'medium', due_date: '' });
const [savingAssign, setSavingAssign] = useState(false);
```

Add a `createDetectionFromGap` handler:
```tsx
function createDetectionFromGap(techniqueId: string, techniqueName: string) {
  navigate(`/detections?prefill_technique=${techniqueId}&prefill_name=${encodeURIComponent('Detect ' + techniqueName)}`);
}
```

Add a `saveAssignment` handler:
```tsx
async function saveAssignment(techniqueId: string) {
  if (!assignForm.assignee.trim()) return;
  setSavingAssign(true);
  try {
    await api.createAssignment({
      entity_type: 'technique',
      entity_id: techniqueId,
      assignee: assignForm.assignee,
      priority: assignForm.priority,
      due_date: assignForm.due_date || null,
    });
    toast('Assignment created');
    setAssigningGap(null);
    setAssignForm({ assignee: '', priority: 'medium', due_date: '' });
  } catch (e: any) {
    toast(e.message, 'error');
  } finally {
    setSavingAssign(false);
  }
}
```

In the gap row JSX (the row that shows each gap technique), add a small action bar before the `expanded` detail section:
```tsx
{/* Quick action bar — visible on hover */}
<div className="flex items-center gap-1.5 mt-1.5">
  <button
    onClick={() => createDetectionFromGap(g.id, g.name)}
    className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
  >
    + Create Detection
  </button>
  <button
    onClick={() => { setAssigningGap(g.id); setAssignForm({ assignee: user?.name ?? '', priority: 'medium', due_date: '' }); }}
    className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
  >
    Assign
  </button>
</div>

{/* Inline assign form */}
{assigningGap === g.id && (
  <div className="mt-2 flex items-center gap-2 p-2 bg-gray-100 dark:bg-slate-800 rounded-lg">
    <input
      type="text" value={assignForm.assignee}
      onChange={e => setAssignForm(f => ({ ...f, assignee: e.target.value }))}
      placeholder="Assignee"
      className="flex-1 min-w-0 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500/50"
    />
    <select
      value={assignForm.priority}
      onChange={e => setAssignForm(f => ({ ...f, priority: e.target.value }))}
      className="text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-800 dark:text-slate-200 focus:outline-none"
    >
      {['critical','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
    </select>
    <input
      type="date" value={assignForm.due_date}
      onChange={e => setAssignForm(f => ({ ...f, due_date: e.target.value }))}
      className="text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-800 dark:text-slate-200 focus:outline-none"
    />
    <button
      onClick={() => saveAssignment(g.id)} disabled={savingAssign}
      className="text-xs px-2 py-1 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/40 disabled:opacity-50 transition-colors"
    >
      {savingAssign ? '…' : 'Save'}
    </button>
    <button onClick={() => setAssigningGap(null)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 px-1">✕</button>
  </div>
)}
```

- [ ] **Step 2: Read prefill params in Detections.tsx**

In `Detections.tsx`, add import:
```typescript
import { useSearchParams } from 'react-router-dom';
```

At the top of the `Detections` component, add:
```tsx
const [searchParams] = useSearchParams();
```

In the `useEffect` that loads initial data, after setting detections, add:
```tsx
// Pre-populate the new detection form from URL params (from "Create Detection from Gap")
const prefillTechnique = searchParams.get('prefill_technique');
const prefillName = searchParams.get('prefill_name');
if (prefillTechnique) {
  setForm(f => ({
    ...f,
    technique_ids: [prefillTechnique],
    name: prefillName ?? f.name,
    status: 'planned',
  }));
  setModalOpen(true);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/GapAnalysis.tsx client/src/pages/Detections.tsx
git commit -m "feat: add Create Detection and Assign quick actions on Gap Analysis"
```

---

### Task 12: "Assign to self" on Priority Queue

**Files:**
- Modify: `client/src/pages/Prioritization.tsx`

- [ ] **Step 1: Add "Assign to self" action**

In `Prioritization.tsx`, add imports:
```typescript
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
```

Add at top of component:
```tsx
const { user } = useAuth();
const { toast } = useToast();
const [assigningSelf, setAssigningSelf] = useState<string | null>(null); // technique_id
```

Add handler:
```tsx
async function assignToSelf(techniqueId: string) {
  if (!user) return;
  setAssigningSelf(techniqueId);
  try {
    await api.createAssignment({
      entity_type: 'technique',
      entity_id: techniqueId,
      assignee: user.name ?? user.email,
      priority: 'medium',
      due_date: null,
    });
    toast('Assigned to you');
  } catch (e: any) {
    toast(e.message, 'error');
  } finally {
    setAssigningSelf(null);
  }
}
```

In the priority queue row JSX, add an "Assign to self" button alongside the existing row content:
```tsx
<button
  onClick={() => assignToSelf(item.technique_id)}
  disabled={assigningSelf === item.technique_id}
  className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-600 hover:bg-gray-300 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors whitespace-nowrap"
>
  {assigningSelf === item.technique_id ? '…' : 'Assign to me'}
</button>
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/Prioritization.tsx
git commit -m "feat: add Assign to self quick action on Priority Queue"
```

---

### Task 13: "Add to Exercise" on ATT&CK Matrix

**Files:**
- Modify: `client/src/pages/AttackMatrix.tsx`

- [ ] **Step 1: Add "Add to Exercise" popover on gap cells**

In `AttackMatrix.tsx`, add state:
```tsx
const [exercises, setExercises] = useState<Array<{ id: number; name: string }>>([]);
const [addToExerciseCell, setAddToExerciseCell] = useState<string | null>(null); // technique_id
const [addingToExercise, setAddingToExercise] = useState(false);
```

Load active exercises once when matrix loads:
```tsx
useEffect(() => {
  api.getExercises()
    .then((all: any[]) => setExercises(all.filter(e => e.status === 'active')))
    .catch(() => {});
}, []);
```

Add handler:
```tsx
async function addTechniqueToExercise(exerciseId: number, techniqueId: string) {
  setAddingToExercise(true);
  try {
    await api.addExerciseTechniques(exerciseId, [techniqueId]);
    toast?.('Technique added to exercise');
    setAddToExerciseCell(null);
  } catch (e: any) {
    toast?.(e.message, 'error');
  } finally {
    setAddingToExercise(false);
  }
}
```

In the cell detail sidebar (when a gap cell is selected), add below the existing content:
```tsx
{selectedCell?.status === 'gap' && exercises.length > 0 && (
  <div className="mt-3">
    <button
      onClick={() => setAddToExerciseCell(v => v === selectedCell.id ? null : selectedCell.id)}
      className="text-xs px-2.5 py-1.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
    >
      + Add to Exercise
    </button>
    {addToExerciseCell === selectedCell.id && (
      <div className="mt-2 space-y-1">
        {exercises.map(ex => (
          <button
            key={ex.id}
            onClick={() => addTechniqueToExercise(ex.id, selectedCell.id)}
            disabled={addingToExercise}
            className="w-full text-left text-xs px-2.5 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 disabled:opacity-50 transition-colors"
          >
            {ex.name}
          </button>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/AttackMatrix.tsx
git commit -m "feat: add Add to Exercise quick action on ATT&CK Matrix gap cells"
```

---

### Task 14: Breadcrumb component

**Files:**
- Create: `client/src/components/Breadcrumb.tsx`

- [ ] **Step 1: Create Breadcrumb component**

```tsx
// client/src/components/Breadcrumb.tsx
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 mb-3">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={11} className="text-gray-300 dark:text-slate-700" />}
          {item.href ? (
            <Link to={item.href} className="hover:text-gray-700 dark:hover:text-slate-300 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-600 dark:text-slate-400 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Add breadcrumbs to ThreatGroups page** (example of a page that benefits from them)

In `client/src/pages/ThreatGroups.tsx`, when showing a group detail panel, add at the top of the detail pane:
```tsx
import Breadcrumb from '../components/Breadcrumb';

// In the detail panel:
<Breadcrumb items={[
  { label: 'Threat Groups', href: '/threats' },
  { label: selectedGroup.name },
]} />
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Breadcrumb.tsx client/src/pages/ThreatGroups.tsx
git commit -m "feat: add Breadcrumb component"
```

---

### Task 15: Smoke test the full feature

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify CommandPalette opens**

Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux). A search modal should appear over the page.

- [ ] **Step 3: Verify notification bell appears**

The sidebar should show a bell icon. Create a TAXII server and trigger a fetch — the badge count should increment within 60s.

- [ ] **Step 4: Verify Gap Analysis quick actions**

Navigate to `/gaps`. Each gap row should show "+ Create Detection" and "Assign" buttons. Click "+ Create Detection" — should navigate to `/detections` with a pre-populated form open.

- [ ] **Step 5: Verify Priority Queue "Assign to me"**

Navigate to `/prioritization`. Each row should show an "Assign to me" button. Click it — should create an assignment silently.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Section 1 — Foundation (search, notifications, quick actions, breadcrumbs)"
```
