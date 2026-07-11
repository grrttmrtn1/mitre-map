/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import KpiCard from './KpiCard';
import ChartCard from './ChartCard';
import { PageHeader, PageShell } from './PageShell';

describe('UI primitives', () => {
  it('provides semantic page and KPI headings', () => {
    render(<PageShell><PageHeader title="Coverage" description="Current posture" /><KpiCard label="Coverage gaps" value="12" detail="parent techniques" /></PageShell>);
    expect(screen.getByRole('heading', { name: 'Coverage', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Coverage gaps' })).toHaveTextContent('12');
  });

  it('exposes a chart title and non-visual summary', () => {
    render(<ChartCard title="Coverage by tactic" summary="Execution: 40%; Discovery: 70%"><div data-testid="visual">chart</div></ChartCard>);
    expect(screen.getByRole('heading', { name: 'Coverage by tactic' })).toBeInTheDocument();
    expect(screen.getByText('Execution: 40%; Discovery: 70%')).toHaveClass('sr-only');
  });
});
