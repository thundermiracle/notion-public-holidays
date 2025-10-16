import { describe, it, expect, vi } from 'vitest';
import { importPublicHolidaysToNotion } from '../src/importer';
import type { NagerPublicHoliday } from '../src/types';
vi.mock('@notionhq/client', () => {
  const calls: any[] = [];
  class Client {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(..._args: any[]) {}
    async request(args: any) {
      calls.push(args);
      if (args.path.includes('/query')) {
        return { results: [], has_more: false, next_cursor: null };
      }
      return {};
    }
  }
  return { Client, __calls: calls } as any;
});
import * as notionModule from '@notionhq/client';

class FakeNotion {
  public calls: any[] = [];
  async request(args: any) {
    this.calls.push(args);
    return {};
  }
}

describe('importPublicHolidaysToNotion', () => {
  it('fetches from Nager and creates pages in Notion', async () => {
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
    ];

    const fetchMock = vi.fn(async (input: string) => {
      if (input.startsWith('https://date.nager.at')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => sample,
        } as any;
      }
      throw new Error('unexpected fetch url: ' + input);
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const holidays = await importPublicHolidaysToNotion({
      source: { countryCode: 'JP', year: 2025 },
      notion: { dataSourceId: 'ds_1', token: 'test' },
    });

    expect(holidays).toEqual([
      { date: '2025-01-01', title: '元日', category: 'Public' },
    ]);
    const createCalls = (notionModule as any).__calls.filter(
      (c: any) => c.path === 'pages',
    );
    expect(createCalls).toHaveLength(1);
    const body = createCalls[0].body;
    expect(body.parent.data_source_id).toBe('ds_1');
    expect(body.properties.Name.title[0].text.content).toBe('元日');
    expect(body.properties.Date.date.start).toBe('2025-01-01');
    expect(body.properties.Category.select.name).toBe('Public');
  });
});
