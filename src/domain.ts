export type OrderStatus = 'confirmed' | 'warning' | 'rejected';

export type PipelineStage =
  | 'ingest'
  | 'validate'
  | 'normalize'
  | 'dedupe'
  | 'consistency-checks'
  | 'persist'
  | 'serve/query';

export type IssueSeverity = 'info' | 'warning' | 'error';

export type IssueCode =
  | 'validation_error'
  | 'discount_tax_mismatch'
  | 'duplicate_window_hash'
  | 'fx_rounding_mismatch'
  | 'fx_assumption_used';

export interface PipelineIssue {
  stage: PipelineStage;
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  details: Record<string, unknown>;
}

export interface MoneyAmount {
  currency: string;
  minor: number;
}

export interface SourceOrderLine {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  discontinued: string | null;
}

export interface SourceOrder {
  orderId: number;
  customerId: string;
  customerCompanyName: string | null;
  customerCountry: string | null;
  employeeId: number | null;
  orderDate: string;
  requiredDate: string | null;
  shippedDate: string | null;
  shipVia: number | null;
  freight: number;
  shipName: string | null;
  shipAddress: string | null;
  shipCity: string | null;
  shipRegion: string | null;
  shipPostalCode: string | null;
  shipCountry: string | null;
  shipperCompanyName: string | null;
  lines: SourceOrderLine[];
}

export interface ValidatedSourceOrder extends SourceOrder {
  orderDate: string;
}

export interface NormalizedLine {
  productId: number;
  productName: string;
  quantity: number;
  discountRate: number;
  sourceUnitPriceMinor: number;
  sourceGrossMinor: number;
  sourceDiscountMinor: number;
  sourceNetMinor: number;
  sourceTaxMinor: number;
  normalizedUnitPriceMinor: number;
  normalizedGrossMinor: number;
  normalizedDiscountMinor: number;
  normalizedNetMinor: number;
  normalizedTaxMinor: number;
  lineFingerprint: string;
}

export interface NormalizedOrder {
  sourceOrderId: number;
  sourceCustomerId: string;
  customerCompanyName: string | null;
  customerCountry: string | null;
  shipCountry: string;
  shipCity: string | null;
  shipRegion: string | null;
  orderedAt: string;
  orderedAtEpoch: number;
  currency: string;
  fxRateToUsd: number;
  sourceCurrency: 'USD';
  sourceGrossMinor: number;
  sourceDiscountMinor: number;
  sourceNetMinor: number;
  sourceTaxMinor: number;
  sourceFreightMinor: number;
  sourceTotalMinor: number;
  normalizedGrossMinor: number;
  normalizedDiscountMinor: number;
  normalizedNetMinor: number;
  normalizedTaxMinor: number;
  normalizedFreightMinor: number;
  normalizedTotalMinor: number;
  duplicateKey: string;
  fingerprint: string;
  lines: NormalizedLine[];
}

export interface RunSummary {
  runId: string;
  correlationId: string;
  status: 'running' | 'completed' | 'failed';
  totalOrders: number;
  persistedOrders: number;
  replayedOrders: number;
  duplicateOrders: number;
  warningOrders: number;
  rejectedOrders: number;
  exceptionCount: number;
}

export interface ListFilters {
  limit: number;
}
