import { NormalizedOrder, PipelineIssue } from '../domain.js';

export interface DuplicateProbe {
  sourceOrderId: number;
  orderedAtEpoch: number;
  duplicateKey: string;
  customerId: string;
}

export function analyzeConsistency(order: NormalizedOrder): PipelineIssue[] {
  const issues: PipelineIssue[] = [];
  const lineNetMinor = order.lines.reduce((total, line) => total + line.normalizedNetMinor, 0);
  const lineTaxMinor = order.lines.reduce((total, line) => total + line.normalizedTaxMinor, 0);
  const netDelta = Math.abs(lineNetMinor - order.normalizedNetMinor);
  const taxDelta = Math.abs(lineTaxMinor - order.normalizedTaxMinor);

  if (netDelta > 1 || taxDelta > 1) {
    issues.push({
      stage: 'consistency-checks',
      code: 'discount_tax_mismatch',
      severity: 'warning',
      message: 'Per-line discount and tax rounding do not reconcile perfectly with order-level totals.',
      details: {
        netDelta,
        taxDelta,
        lineNetMinor,
        lineTaxMinor,
        orderNetMinor: order.normalizedNetMinor,
        orderTaxMinor: order.normalizedTaxMinor
      }
    });
  }

  if (Math.abs(order.normalizedTotalMinor - (order.normalizedNetMinor + order.normalizedTaxMinor + order.normalizedFreightMinor)) > 0) {
    issues.push({
      stage: 'consistency-checks',
      code: 'fx_rounding_mismatch',
      severity: 'warning',
      message: 'Currency conversion introduced a rounding delta at the order level.',
      details: {
        normalizedTotalMinor: order.normalizedTotalMinor,
        recomposedTotalMinor: order.normalizedNetMinor + order.normalizedTaxMinor + order.normalizedFreightMinor
      }
    });
  }

  return issues;
}
