/** Accepts whole balances written as numbers or as decimal text with zero fractional units. */
export function parseSpreadsheetStock(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000 ? value : NaN;
  }

  const text = String(value ?? '').trim();
  let digits: string;
  if (/^\d+$/.test(text)) digits = text;
  else if (/^\d{1,3}(\.\d{3})+,0+$/.test(text)) digits = text.split(',')[0].replaceAll('.', '');
  else if (/^\d{1,3}(,\d{3})+\.0+$/.test(text)) digits = text.split('.')[0].replaceAll(',', '');
  else if (/^\d+[,.]0+$/.test(text) && !/^\d{1,3}[,.]000$/.test(text)) digits = text.split(/[,.]/)[0];
  else return NaN;

  return parseSpreadsheetStock(Number(digits));
}
