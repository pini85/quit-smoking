/**
 * Currency formatting in the device locale. `Intl.NumberFormat` throws a
 * `RangeError` on a currency code it doesn't recognise, and a profile is
 * user-supplied data that outlives any list we ship — so a bad code degrades
 * to "12.34 XYZ" instead of blanking the whole screen.
 */
export function formatMoney(amount: number, currency: string): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(safe);
  } catch {
    return `${safe.toFixed(2)} ${currency}`;
  }
}

export default formatMoney;
