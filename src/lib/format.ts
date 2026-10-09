const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;
/** A slow walking pace (m/s), so the time estimate holds for kūpuna and kids too. */
export const WALK_SPEED_MS = 1.0;

function unit(lang: string, value: number, u: string, digits: number): string {
  try {
    return new Intl.NumberFormat(lang, {
      style: 'unit',
      unit: u,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    // Languages Intl doesn't know (e.g. Chuukese) fall back to English formatting.
    return new Intl.NumberFormat('en', {
      style: 'unit',
      unit: u,
      maximumFractionDigits: digits,
    }).format(value);
  }
}

/**
 * Distance in the units people in Hawaiʻi use (miles/feet), with metric in brackets.
 * Under a tenth of a mile shows feet, rounded to 10 ft; otherwise miles to 0.1.
 */
export function formatDistance(meters: number, lang = 'en'): string {
  const miles = meters / METERS_PER_MILE;
  const metric =
    meters < 1000
      ? unit(lang, Math.round(meters / 10) * 10, 'meter', 0)
      : unit(lang, meters / 1000, 'kilometer', 1);
  const imperial =
    miles < 0.1
      ? unit(lang, Math.round(meters / METERS_PER_FOOT / 10) * 10, 'foot', 0)
      : unit(lang, miles, 'mile', 1);
  return `${imperial} (${metric})`;
}

/** Minimum minutes on foot for a straight-line distance (real routes are longer). */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.ceil(meters / WALK_SPEED_MS / 60));
}

/** "3 hours ago", "yesterday", in the user's language. */
export function formatAge(
  from: Date | number,
  now: Date | number = Date.now(),
  lang = 'en',
): string {
  const seconds = (new Date(from).getTime() - new Date(now).getTime()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 86400],
    ['month', 30 * 86400],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  } catch {
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  }
  for (const [u, s] of steps)
    if (Math.abs(seconds) >= s) return rtf.format(Math.round(seconds / s), u);
  return rtf.format(0, 'minute');
}

/** A date like "Oct 9, 2026", or "Apr 2025" for a YYYY-MM string. */
export function formatDate(value: string | number | Date, lang = 'en'): string {
  const monthOnly = typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
  const d =
    typeof value === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(value)
      ? new Date(`${monthOnly ? `${value}-01` : value}T12:00:00`)
      : new Date(value);
  const opts: Intl.DateTimeFormatOptions = monthOnly
    ? { year: 'numeric', month: 'short' }
    : { year: 'numeric', month: 'short', day: 'numeric' };
  try {
    return d.toLocaleDateString(lang, opts);
  } catch {
    return d.toLocaleDateString('en', opts);
  }
}

export function formatTime(value: number | Date, lang = 'en'): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  try {
    return new Date(value).toLocaleTimeString(lang, opts);
  } catch {
    return new Date(value).toLocaleTimeString('en', opts);
  }
}
