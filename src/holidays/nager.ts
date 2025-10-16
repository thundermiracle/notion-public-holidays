import type { HolidayItem, NagerPublicHoliday } from '../types';

export async function fetchNagerPublicHolidays(
  countryCode: string,
  year: number = new Date().getFullYear(),
): Promise<HolidayItem[]> {
  const cc = String(countryCode || '')
    .trim()
    .toUpperCase();
  if (!cc) throw new Error('countryCode is required');
  if (!/^\d{4}$/.test(String(year)))
    throw new Error('year must be a 4-digit number');

  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok)
    throw new Error(
      `Failed to fetch holidays: ${res.status} ${res.statusText}`,
    );

  const data = (await res.json()) as NagerPublicHoliday[];
  if (!Array.isArray(data))
    throw new Error('Invalid Nager response: not an array');

  const items: HolidayItem[] = data.map((holiday) => ({
    date: holiday.date,
    title: holiday.localName || holiday.name,
    category:
      Array.isArray(holiday.types) && holiday.types.length > 0
        ? String(holiday.types[0])
        : 'Public',
  }));

  items.sort((left, right) => left.date.localeCompare(right.date));
  return items;
}
