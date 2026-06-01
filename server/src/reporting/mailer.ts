import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let _transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  if (_transporter) return _transporter;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host) throw new Error('SMTP_HOST environment variable not set. Configure SMTP to enable email reports.');
  _transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: user ? { user, pass } : undefined,
    tls: { rejectUnauthorized: process.env.SMTP_INSECURE !== 'true' },
  });
  return _transporter;
}

export async function sendReportEmail(opts: {
  to: string[];
  subject: string;
  htmlBody: string;
  attachmentName?: string;
  attachmentContent?: Buffer;
}): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'mitremap@localhost';
  await transporter.sendMail({
    from,
    to: opts.to.join(', '),
    subject: opts.subject,
    html: opts.htmlBody,
    ...(opts.attachmentName && opts.attachmentContent ? {
      attachments: [{ filename: opts.attachmentName, content: opts.attachmentContent, contentType: 'application/pdf' }],
    } : {}),
  });
}

export function buildReportHtml(reportType: string, data: any): string {
  const timestamp = new Date().toLocaleString();
  const title = ({ executive: 'Executive Summary', trends: 'Coverage Trends', threats: 'Threat Landscape', gaps: 'Prioritized Gaps', compliance: 'Compliance Report' } as Record<string,string>)[reportType] ?? reportType;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,sans-serif;color:#1e293b;padding:32px;max-width:800px;margin:0 auto}
    h1{font-size:24px;color:#0f172a;border-bottom:2px solid #3b82f6;padding-bottom:8px}
    h2{font-size:16px;color:#334155;margin-top:24px}
    .kpi{display:inline-block;background:#f1f5f9;border-radius:8px;padding:12px 16px;margin:4px;text-align:center}
    .kpi .value{font-size:28px;font-weight:700;color:#3b82f6}
    .kpi .label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
    th{text-align:left;padding:8px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
    td{padding:8px;border-bottom:1px solid #e2e8f0}
    .footer{margin-top:32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
  </style></head><body>
  <h1>MitreMap — ${title}</h1>
  <p style="color:#64748b;font-size:13px;">Generated: ${timestamp}</p>
  ${reportType === 'executive' && data ? `
    <div>
      <div class="kpi"><div class="value">${data.coverage_pct ?? 0}%</div><div class="label">Coverage</div></div>
      <div class="kpi"><div class="value">${data.active_detections ?? 0}</div><div class="label">Detections</div></div>
      <div class="kpi"><div class="value">${data.gap_techniques ?? 0}</div><div class="label">Gaps</div></div>
      <div class="kpi"><div class="value">${data.risk_score ?? 0}</div><div class="label">Risk Score</div></div>
    </div>
    ${data.tactic_breakdown ? `<h2>Coverage by Tactic</h2><table><thead><tr><th>Tactic</th><th>Covered</th><th>Total</th><th>%</th></tr></thead><tbody>
      ${(data.tactic_breakdown ?? []).map((t: any) => `<tr><td>${t.tactic_name}</td><td>${t.covered}</td><td>${t.total}</td><td>${t.pct}%</td></tr>`).join('')}
    </tbody></table>` : ''}
  ` : ''}
  ${reportType === 'gaps' && data?.gaps ? `<h2>Top Priority Gaps</h2><table><thead><tr><th>Technique</th><th>ID</th><th>Priority</th><th>Tactics</th></tr></thead><tbody>
    ${(data.gaps ?? []).slice(0,20).map((g: any) => `<tr><td>${g.name}</td><td style="font-family:monospace">${g.id}</td><td>${g.priority_score}</td><td>${(g.tactic_names??[]).join(', ')}</td></tr>`).join('')}
  </tbody></table>` : ''}
  <div class="footer">MitreMap · Detection Coverage Platform · Report generated automatically by scheduled delivery</div>
  </body></html>`;
}
