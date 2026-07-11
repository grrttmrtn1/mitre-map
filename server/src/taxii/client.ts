import { safeHttpsRequest } from '../integrations/url-validator';

export type TaxiiAuthType = 'none' | 'basic' | 'bearer';

export interface TaxiiServerConfig {
  url: string;
  api_root?: string | null;
  collection_id?: string | null;
  auth_type: TaxiiAuthType;
  username?: string | null;
  password?: string | null;
  token?: string | null;
  ssl_verify?: boolean;
}

export interface TaxiiCollection {
  id: string;
  title: string;
  description?: string;
  can_read: boolean;
  can_write: boolean;
  media_types?: string[];
}

export interface StixObject {
  type: string;
  id: string;
  name?: string;
  description?: string;
  external_references?: Array<{
    source_name: string;
    external_id?: string;
    url?: string;
    description?: string;
  }>;
  relationship_type?: string;
  source_ref?: string;
  target_ref?: string;
  aliases?: string[];
  revoked?: boolean;
  [key: string]: unknown;
}


export class TaxiiClient {
  private config: TaxiiServerConfig;

  constructor(config: TaxiiServerConfig) {
    this.config = config;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/taxii+json;version=2.1',
    };
    if (this.config.auth_type === 'basic' && this.config.username && this.config.password) {
      const b64 = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      headers['Authorization'] = `Basic ${b64}`;
    } else if (this.config.auth_type === 'bearer' && this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }
    return headers;
  }

  private async fetchJson(url: string, timeoutMs = 60_000): Promise<unknown> {
    const headers = this.buildHeaders();
    try {
      const res = await safeHttpsRequest(url, {
        headers,
        timeoutMs,
        rejectUnauthorized: this.config.ssl_verify !== false,
      });
      if (!res.ok) {
        throw new Error(`TAXII ${res.status}: ${res.body.slice(0, 200)}`);
      }
      return JSON.parse(res.body);
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error(`TAXII request timed out after ${timeoutMs / 1000}s: ${url}`);
      throw err;
    }
  }

  private base(): string {
    return this.config.url.replace(/\/$/, '');
  }

  private rootPath(): string {
    const r = (this.config.api_root ?? '').replace(/^\/|\/$/g, '');
    return r ? `/${r}` : '';
  }

  async discover(): Promise<{ api_roots: string[] }> {
    return this.fetchJson(`${this.base()}/taxii/`) as Promise<{ api_roots: string[] }>;
  }

  async listCollections(): Promise<TaxiiCollection[]> {
    const data = (await this.fetchJson(`${this.base()}${this.rootPath()}/collections/`)) as any;
    return (data.collections ?? []) as TaxiiCollection[];
  }

  async fetchObjects(addedAfter?: string): Promise<StixObject[]> {
    const collId = (this.config.collection_id ?? '').replace(/\/$/, '');
    const baseUrl = `${this.base()}${this.rootPath()}/collections/${collId}/objects/`;

    const allObjects: StixObject[] = [];
    let cursor: string | undefined = addedAfter;
    let isFirst = true;
    const MAX_PAGES = 50;

    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams();
      if (cursor) {
        params.set(isFirst ? 'added_after' : 'next', cursor);
      }
      const url = baseUrl + (params.toString() ? `?${params}` : '');
      const data = (await this.fetchJson(url)) as any;
      allObjects.push(...((data.objects ?? []) as StixObject[]));
      if (!data.more || !data.next) break;
      cursor = data.next;
      isFirst = false;
    }

    return allObjects;
  }
}
