import { describe, it, expect, vi } from 'vitest';
import { fetchNagerPublicHolidays } from '../src/holidays/nager';
import type { NagerPublicHoliday } from '../src/types';

describe('fetchNagerPublicHolidays', () => {
  it('fetches and maps holidays from Nager by country/year', async () => {
    const sample: NagerPublicHoliday[] = [
      {
        date: '2025-01-01',
        localName: '元日',
        name: "New Year's Day",
        countryCode: 'JP',
        fixed: false,
        global: true,
        counties: null,
        launchYear: null,
        types: ['Public'],
      },
      {
        date: '2025-02-11',
        localName: '建国記念の日',
        name: 'Foundation Day',
        countryCode: 'JP',
        fixed: false,
        global: true,
        counties: null,
        launchYear: null,
        types: ['Public'],
      },
    ];

    const fetchMock = vi.fn(async (input: string) => {
      expect(input).toBe('https://date.nager.at/api/v3/PublicHolidays/2025/JP');
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => sample,
      } as any;
    });

    vi.stubGlobal('fetch', fetchMock as any);
    const items = await fetchNagerPublicHolidays('jp', 2025);
    expect(items).toEqual([
      { date: '2025-01-01', title: '元日', category: 'Public' },
      { date: '2025-02-11', title: '建国記念の日', category: 'Public' },
    ]);
  });

  it('throws on non-OK response', async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: false,
          status: 500,
          statusText: 'ERR',
          json: async () => [],
        }) as any,
    );
    vi.stubGlobal('fetch', fetchMock as any);
    await expect(fetchNagerPublicHolidays('JP', 2025)).rejects.toThrow(
      'Failed to fetch holidays',
    );
  });
});
