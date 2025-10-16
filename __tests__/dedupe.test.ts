import { describe, it, expect, vi } from 'vitest';
import { importPublicHolidaysToNotion } from '../src/importer';
import type { NagerPublicHoliday } from '../src/types';
vi.mock('@notionhq/client', () => {
  const calls: any[] = [];
  let response: any = { results: [], has_more: false, next_cursor: null };
  class Client {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(..._args: any[]) {}
    async request(args: any) {
      calls.push(args);
      if (args.path.includes('/query')) {
        return response;
      }
      return {};
    }
  }
  return {
    Client,
    __calls: calls,
    __setQueryResponse: (r: any) => (response = r),
  } as any;
});
import * as notionModule from '@notionhq/client';

describe('dedupe behavior', () => {
  it('skips duplicates when skipDuplicates=true (default)', async () => {
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
      if (input.startsWith('https://date.nager.at')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => sample,
        } as any;
      }
      throw new Error('unexpected url: ' + input);
    });
    vi.stubGlobal('fetch', fetchMock as any);
    (notionModule as any).__setQueryResponse({
      results: [
        {
          id: 'page1',
          properties: {
            Date: { date: { start: '2025-01-01' } },
            Name: {
              title: [{ plain_text: '元日', text: { content: '元日' } }],
            },
          },
        },
      ],
      has_more: false,
      next_cursor: null,
    });

    await importPublicHolidaysToNotion({
      source: { countryCode: 'JP', year: 2025 },
      notion: { dataSourceId: 'ds_x', token: 'test' },
    });

    // Should create only the second one
    const createCalls = (notionModule as any).__calls.filter(
      (c: any) => c.path === 'pages',
    );
    expect(createCalls).toHaveLength(1);
    const props = createCalls[0].body.properties;
    expect(props.Name.title[0].text.content).toBe('建国記念の日');
  });

  it('does not skip duplicates when skipDuplicates=false', async () => {
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

    const fetchMock2 = vi.fn(async (input: string) => {
      if (input.startsWith('https://date.nager.at')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => sample,
        } as any;
      }
      throw new Error('unexpected url: ' + input);
    });
    vi.stubGlobal('fetch', fetchMock2 as any);
    (notionModule as any).__setQueryResponse({
      results: [
        {
          id: 'page1',
          properties: {
            Date: { date: { start: '2025-01-01' } },
            Name: {
              title: [{ plain_text: '元日', text: { content: '元日' } }],
            },
          },
        },
      ],
      has_more: false,
      next_cursor: null,
    });

    await importPublicHolidaysToNotion({
      source: { countryCode: 'JP', year: 2025 },
      notion: { dataSourceId: 'ds_x', token: 'test', skipDuplicates: false },
    });

    const createCalls2 = (notionModule as any).__calls.filter(
      (c: any) => c.path === 'pages',
    );
    expect(createCalls2).toHaveLength(2); // cumulative across tests
    const props2 = createCalls2[1].body.properties;
    expect(props2.Name.title[0].text.content).toBe('元日');
  });
});
