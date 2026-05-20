import { sha256 } from './hash.js';

export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  Argentina: 'ARS',
  Austria: 'EUR',
  Belgium: 'EUR',
  Brazil: 'BRL',
  Canada: 'CAD',
  Denmark: 'DKK',
  Finland: 'EUR',
  France: 'EUR',
  Germany: 'EUR',
  Ireland: 'EUR',
  Italy: 'EUR',
  Mexico: 'MXN',
  Norway: 'NOK',
  Poland: 'PLN',
  Portugal: 'EUR',
  Spain: 'EUR',
  Sweden: 'SEK',
  Switzerland: 'CHF',
  UK: 'GBP',
  USA: 'USD',
  Venezuela: 'VES'
};

export const CURRENCY_TO_USD_RATE: Record<string, number> = {
  ARS: 0.0012,
  BRL: 0.19,
  CAD: 0.74,
  CHF: 1.12,
  DKK: 0.145,
  EUR: 1.08,
  GBP: 1.27,
  MXN: 0.058,
  NOK: 0.091,
  PLN: 0.25,
  SEK: 0.095,
  USD: 1,
  VES: 0.028
};

export const COUNTRY_TO_TAX_RATE: Record<string, number> = {
  Argentina: 0.21,
  Austria: 0.20,
  Belgium: 0.21,
  Brazil: 0.17,
  Canada: 0.13,
  Denmark: 0.25,
  Finland: 0.24,
  France: 0.20,
  Germany: 0.19,
  Ireland: 0.23,
  Italy: 0.22,
  Mexico: 0.16,
  Norway: 0.25,
  Poland: 0.23,
  Portugal: 0.23,
  Spain: 0.21,
  Sweden: 0.25,
  Switzerland: 0.077,
  UK: 0.20,
  USA: 0.0825,
  Venezuela: 0.16
};

const DEFAULT_TAX_RATE = 0.0825;

export function currencyForCountry(country: string | null | undefined): string {
  if (!country) {
    return 'USD';
  }

  return COUNTRY_TO_CURRENCY[country] ?? 'USD';
}

export function taxRateForCountry(country: string | null | undefined): number {
  if (!country) {
    return DEFAULT_TAX_RATE;
  }

  return COUNTRY_TO_TAX_RATE[country] ?? DEFAULT_TAX_RATE;
}

export function fxRateToUsd(currency: string): number {
  return CURRENCY_TO_USD_RATE[currency] ?? 1;
}

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function convertUsdMinorToCurrencyMinor(amountMinor: number, currency: string): number {
  const rate = fxRateToUsd(currency);
  return Math.round(amountMinor / rate);
}

export function floorEpochMinuteBucket(epochSeconds: number, windowMinutes: number): number {
  const seconds = windowMinutes * 60;
  return Math.floor(epochSeconds / seconds) * seconds;
}

export function buildLineFingerprint(parts: Array<string | number>): string {
  return sha256(parts.join('|'));
}
