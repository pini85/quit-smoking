/**
 * Formats a `Date` as a local ISO 8601 date-time string WITH the local
 * timezone offset (`YYYY-MM-DDTHH:mm:ss±HH:MM`) — deliberately NOT a `Z`/UTC
 * conversion. Several domain fields (`QuitProfile.quitAt`,
 * `CravingSession.startedAt`, `createdAt`/`updatedAt` timestamps) are
 * documented as "ISO WITH offset" precisely so the *local* hour-of-day
 * survives even if the device's timezone changes later — a plain
 * `date.toISOString()` would silently convert to UTC and lose that.
 *
 * Pure function: no `Date.now()`/argless `new Date()` inside, so it stays
 * safe to import anywhere (including modules that must never touch the wall
 * clock themselves).
 */
export function toLocalIso(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  // `getTimezoneOffset()` returns minutes *behind* UTC (positive west of
  // UTC) — the opposite sign convention from an ISO offset — so negate it.
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
}

export default toLocalIso;
