export interface TicketInput {
  summary: string;
  description: string;
  priority?: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
}

export interface TicketResult {
  ticket_id: string;
  url: string;
}

export async function createJiraTicket(config: {
  base_url: string;
  username: string;
  token: string;
  project_key: string;
}, input: TicketInput): Promise<TicketResult> {
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
  if (!res.ok) throw new Error(`Jira error: ${res.status} ${await res.text()}`);
  const j = await res.json() as any;
  return { ticket_id: j.key, url: `${config.base_url}/browse/${j.key}` };
}

export async function createServiceNowTicket(config: {
  base_url: string;
  username: string;
  password: string;
  assignment_group?: string;
}, input: TicketInput): Promise<TicketResult> {
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
  if (!res.ok) throw new Error(`ServiceNow error: ${res.status} ${await res.text()}`);
  const j = await res.json() as any;
  const sysId = j.result.sys_id;
  const ticketId = j.result.number;
  return { ticket_id: ticketId, url: `${config.base_url}/incident.do?sys_id=${sysId}` };
}
