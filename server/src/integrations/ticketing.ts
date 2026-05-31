export interface TicketInput {
  summary: string;
  description: string;
  priority?: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
}

export interface TicketResult {
  ticket_id: string;
  url: string;
}

import { validateBaseUrl } from './url-validator';

const JIRA_KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/;
const SN_SYS_ID_RE = /^[a-f0-9]{32}$/;
const SN_NUMBER_RE = /^[A-Z]+\d+$/;

export async function createJiraTicket(config: {
  base_url: string;
  username: string;
  token: string;
  project_key: string;
}, input: TicketInput): Promise<TicketResult> {
  validateBaseUrl(config.base_url);
  const auth = Buffer.from(`${config.username}:${config.token}`).toString('base64');
  const body = {
    fields: {
      project: { key: config.project_key },
      summary: input.summary,
      description: {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: input.description }] }],
      },
      issuetype: { name: 'Task' },
      priority: { name: input.priority === 'highest' ? 'Highest' : input.priority === 'high' ? 'High' : input.priority === 'low' ? 'Low' : 'Medium' },
    },
  };
  const res = await fetch(`${config.base_url}/rest/api/3/issue`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Jira error: ${res.status} ${res.statusText}`);
  const j = await res.json() as any;
  if (!JIRA_KEY_RE.test(j.key)) throw new Error('Jira returned invalid issue key');
  return { ticket_id: j.key, url: `${config.base_url}/browse/${encodeURIComponent(j.key)}` };
}

export async function createServiceNowTicket(config: {
  base_url: string;
  username: string;
  password: string;
  assignment_group?: string;
}, input: TicketInput): Promise<TicketResult> {
  validateBaseUrl(config.base_url);
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const urgency = input.priority === 'highest' || input.priority === 'high' ? '1'
    : input.priority === 'low' || input.priority === 'lowest' ? '3' : '2';
  const body: Record<string, string> = {
    short_description: input.summary,
    description: input.description,
    urgency,
  };
  if (config.assignment_group) body.assignment_group = config.assignment_group;

  const res = await fetch(`${config.base_url}/api/now/table/incident`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ServiceNow error: ${res.status} ${res.statusText}`);
  const j = await res.json() as any;
  const sysId: string = j.result?.sys_id ?? '';
  const ticketId: string = j.result?.number ?? '';
  if (!SN_SYS_ID_RE.test(sysId)) throw new Error('ServiceNow returned invalid sys_id');
  if (!SN_NUMBER_RE.test(ticketId)) throw new Error('ServiceNow returned invalid ticket number');
  return { ticket_id: ticketId, url: `${config.base_url}/incident.do?sys_id=${encodeURIComponent(sysId)}` };
}
