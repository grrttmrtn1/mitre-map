import { getKnex, rawAll, rawGet, rawRun } from '../db/database';
import { decryptJson } from './crypto';
import type { Knex as KnexType } from 'knex';

interface GithubSyncConfig {
  id: number;
  repo_url: string;
  branch: string;
  path_glob: string;
  token_enc: string | null;
  last_sha: string | null;
}

const SAFE_BRANCH_RE = /^[A-Za-z0-9._\-/]+$/;

function validateBranch(branch: string): void {
  if (!SAFE_BRANCH_RE.test(branch) || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) {
    throw new Error(`Unsafe branch name: ${branch}`);
  }
}

function toApiBase(repoUrl: string): string {
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) throw new Error(`Cannot parse GitHub repo URL: ${repoUrl}`);
  return `https://api.github.com/repos/${match[1].replace(/\.git$/, '')}`;
}

async function getLatestSha(apiBase: string, branch: string, token: string | null): Promise<string> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${apiBase}/commits/${encodeURIComponent(branch)}`, { headers });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return ((await res.json()) as any).sha;
}

async function getChangedYmlFiles(
  apiBase: string,
  branch: string,
  lastSha: string | null,
  token: string | null,
): Promise<Array<{ path: string; content: string }>> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  if (!lastSha) {
    const treeRes = await fetch(`${apiBase}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers });
    if (!treeRes.ok) throw new Error(`GitHub tree error: ${treeRes.status}`);
    const tree = (await treeRes.json()) as any;
    const ymlPaths = ((tree.tree ?? []) as any[])
      .filter((f: any) => f.type === 'blob' && f.path.endsWith('.yml'))
      .slice(0, 200);
    const files: Array<{ path: string; content: string }> = [];
    for (const f of ymlPaths) {
      const params = new URLSearchParams({ ref: branch });
      const blobRes = await fetch(`${apiBase}/contents/${encodeURIComponent(f.path)}?${params}`, { headers });
      if (!blobRes.ok) continue;
      const blob = (await blobRes.json()) as any;
      files.push({ path: f.path, content: Buffer.from(blob.content, 'base64').toString('utf8') });
    }
    return files;
  }

  const compareRes = await fetch(`${apiBase}/compare/${encodeURIComponent(lastSha)}...${encodeURIComponent(branch)}`, { headers });
  if (!compareRes.ok) throw new Error(`GitHub compare error: ${compareRes.status}`);
  const compare = (await compareRes.json()) as any;
  const files: Array<{ path: string; content: string }> = [];
  for (const f of ((compare.files ?? []) as any[]).filter((f: any) => f.filename.endsWith('.yml'))) {
    const params = new URLSearchParams({ ref: branch });
    const contentRes = await fetch(`${apiBase}/contents/${encodeURIComponent(f.filename)}?${params}`, { headers });
    if (!contentRes.ok) continue;
    const blob = (await contentRes.json()) as any;
    files.push({ path: f.filename, content: Buffer.from(blob.content, 'base64').toString('utf8') });
  }
  return files;
}

// NOTE: taxii_pending_ingests has a schema designed for STIX objects (requires
// server_id FK, stix_id, stix_type). It does not accommodate generic SIGMA file
// staging. Until a dedicated github_sync_staged_files table is added via
// migration, this function logs a warning and returns the file count without
// persisting rows.
function stageFiles(
  _db: KnexType,
  _configId: number,
  files: Array<{ path: string; content: string }>,
): Promise<number> {
  if (files.length > 0) {
    console.warn(
      `[github-sync] ${files.length} SIGMA file(s) fetched but not staged: ` +
        'taxii_pending_ingests schema is incompatible (STIX-only). ' +
        'Add a github_sync_staged_files migration to enable persistent staging.',
    );
  }
  return Promise.resolve(files.length);
}

export async function runGithubSync(configId: number): Promise<{ staged: number; sha: string }> {
  const db = getKnex();
  const cfg = await rawGet<GithubSyncConfig>(
    db,
    'SELECT * FROM github_sync_configs WHERE id = ?',
    [configId],
  );
  if (!cfg) throw new Error('Config not found');
  validateBranch(cfg.branch);

  const token = cfg.token_enc ? (decryptJson(cfg.token_enc).token ?? null) : null;
  const apiBase = toApiBase(cfg.repo_url);
  const sha = await getLatestSha(apiBase, cfg.branch, token);

  if (sha === cfg.last_sha) return { staged: 0, sha };

  const files = await getChangedYmlFiles(apiBase, cfg.branch, cfg.last_sha, token);
  const staged = await stageFiles(db, configId, files);
  await rawRun(db, 'UPDATE github_sync_configs SET last_sha = ?, last_synced_at = CURRENT_TIMESTAMP WHERE id = ?', [
    sha,
    configId,
  ]);

  return { staged, sha };
}
