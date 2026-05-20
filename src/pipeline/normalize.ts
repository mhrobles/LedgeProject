import { NormalizedLine, NormalizedOrder, SourceOrder } from '../domain.js';
import {
  buildLineFingerprint,
  convertUsdMinorToCurrencyMinor,
  currencyForCountry,
  floorEpochMinuteBucket,
  taxRateForCountry,
  toMinorUnits,
  fxRateToUsd
} from '../lib/money.js';

export interface NormalizeOptions {
  baseCurrency: string;
  windowMinutes: number;
}

export function normalizeOrder(order: SourceOrder, options: NormalizeOptions): NormalizedOrder {
  const shipCountry = order.shipCountry?.trim() || order.customerCountry?.trim() || 'USA';
  const currency = currencyForCountry(shipCountry);
  const fxRate = fxRateToUsd(currency);
  const taxRate = taxRateForCountry(shipCountry);
  const orderedAt = new Date(order.orderDate).toISOString();
  const orderedAtEpoch = Math.floor(new Date(order.orderDate).getTime() / 1000);
  const timeBucket = floorEpochMinuteBucket(orderedAtEpoch, options.windowMinutes);

  const lines: NormalizedLine[] = [];
  const lineFingerprints: string[] = [];
  let totalSourceGrossMinor = 0;
  let totalSourceDiscountMinor = 0;
  let totalSourceTaxMinor = 0;

  for (const line of order.lines) {
    const sourceUnitPriceMinor = toMinorUnits(line.unitPrice);
    const lineSourceGrossMinor = sourceUnitPriceMinor * line.quantity;
    const lineSourceDiscountMinor = Math.round(lineSourceGrossMinor * line.discount);
    const lineSourceNetMinor = lineSourceGrossMinor - lineSourceDiscountMinor;
    const lineSourceTaxMinor = Math.round(lineSourceNetMinor * taxRate);
    const normalizedUnitPriceMinor = convertUsdMinorToCurrencyMinor(sourceUnitPriceMinor, currency);
    const normalizedGrossMinor = convertUsdMinorToCurrencyMinor(lineSourceGrossMinor, currency);
    const normalizedDiscountMinor = convertUsdMinorToCurrencyMinor(lineSourceDiscountMinor, currency);
    const normalizedNetMinor = convertUsdMinorToCurrencyMinor(lineSourceNetMinor, currency);
    const normalizedTaxMinor = convertUsdMinorToCurrencyMinor(lineSourceTaxMinor, currency);
    const lineFingerprint = buildLineFingerprint([
      line.productId,
      line.quantity,
      sourceUnitPriceMinor,
      lineSourceDiscountMinor
    ]);

    const normalizedLine: NormalizedLine = {
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      discountRate: line.discount,
      sourceUnitPriceMinor,
      sourceGrossMinor: lineSourceGrossMinor,
      sourceDiscountMinor: lineSourceDiscountMinor,
      sourceNetMinor: lineSourceNetMinor,
      sourceTaxMinor: lineSourceTaxMinor,
      normalizedUnitPriceMinor,
      normalizedGrossMinor,
      normalizedDiscountMinor,
      normalizedNetMinor,
      normalizedTaxMinor,
      lineFingerprint
    };

    lines.push(normalizedLine);
    lineFingerprints.push(lineFingerprint);
    totalSourceGrossMinor += lineSourceGrossMinor;
    totalSourceDiscountMinor += lineSourceDiscountMinor;
    totalSourceTaxMinor += lineSourceTaxMinor;
  }

  const sourceGrossMinor = totalSourceGrossMinor;
  const sourceDiscountMinor = totalSourceDiscountMinor;
  const sourceTaxMinor = totalSourceTaxMinor;
  const sourceNetMinor = sourceGrossMinor - sourceDiscountMinor;
  const sourceFreightMinor = toMinorUnits(order.freight);
  const sourceTotalMinor = sourceNetMinor + sourceTaxMinor + sourceFreightMinor;

  const normalizedGrossMinor = convertUsdMinorToCurrencyMinor(sourceGrossMinor, currency);
  const normalizedDiscountMinor = convertUsdMinorToCurrencyMinor(sourceDiscountMinor, currency);
  const normalizedNetMinor = convertUsdMinorToCurrencyMinor(sourceNetMinor, currency);
  const normalizedTaxMinor = convertUsdMinorToCurrencyMinor(sourceTaxMinor, currency);
  const normalizedFreightMinor = convertUsdMinorToCurrencyMinor(sourceFreightMinor, currency);
  const normalizedTotalMinor = normalizedNetMinor + normalizedTaxMinor + normalizedFreightMinor;

  const lineFingerprint = buildLineFingerprint(lineFingerprints.sort());
  const fingerprint = buildLineFingerprint([
    order.customerId,
    orderedAt,
    shipCountry,
    currency,
    lineFingerprint
  ]);
  const duplicateKey = buildLineFingerprint([
    order.customerId,
    timeBucket,
    lineFingerprint
  ]);

  return {
    sourceOrderId: order.orderId,
    sourceCustomerId: order.customerId,
    customerCompanyName: order.customerCompanyName,
    customerCountry: order.customerCountry,
    shipCountry,
    shipCity: order.shipCity,
    shipRegion: order.shipRegion,
    orderedAt,
    orderedAtEpoch,
    currency,
    fxRateToUsd: fxRate,
    sourceCurrency: 'USD',
    sourceGrossMinor,
    sourceDiscountMinor,
    sourceNetMinor,
    sourceTaxMinor,
    sourceFreightMinor,
    sourceTotalMinor,
    normalizedGrossMinor,
    normalizedDiscountMinor,
    normalizedNetMinor,
    normalizedTaxMinor,
    normalizedFreightMinor,
    normalizedTotalMinor,
    duplicateKey,
    fingerprint,
    lines
  };
}
