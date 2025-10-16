import { describe, it, expect, vi } from 'vitest';
import { createHolidayPages } from '../src/notion/create-pages';
vi.mock('@notionhq/client', () => {
  const calls: any[] = [];
  class Client {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(..._args: any[]) {}
    async request(args: any) {
      calls.push(args);
      return {};
    }
  }
  return { Client, __calls: calls } as any;
});
import * as notionModule from '@notionhq/client';

describe('createHolidayPages', () => {
  it('creates pages under data_source_id with provided property names', async () => {
    await createHolidayPages({
      dataSourceId: 'ds_999',
      notionToken: 'test',
      holidays: [
        { date: '2025-01-01', title: '元日', category: 'Public' },
        { date: '2025-02-11', title: '建国記念の日', category: 'Public' },
      ],
      propertyNames: { title: 'Name', date: 'Date', category: 'Category' },
      skipDuplicates: false,
    });

    expect((notionModule as any).__calls).toHaveLength(2);
    for (const call of (notionModule as any).__calls) {
      expect(call.path).toBe('pages');
      expect(call.method).toBe('post');
      const body = call.body;
      expect(body.parent.data_source_id).toBe('ds_999');
      expect(body.parent.type).toBe('data_source_id');
      const props = body.properties;
      expect(props.Name.title[0].text.content).toBeTruthy();
      expect(props.Date.date.start).toMatch(/^2025-/);
      expect(props.Category.select.name).toBe('Public');
    }
  });

  it('uses default property names when not provided', async () => {
    await createHolidayPages({
      dataSourceId: 'ds_999',
      notionToken: 'test',
      holidays: [{ date: '2025-03-20', title: '春分の日', category: 'Public' }],
      skipDuplicates: false,
    });

    expect((notionModule as any).__calls).toHaveLength(3); // cumulative across tests in this file
    const call = (notionModule as any).__calls[2];
    const body = call.body;
    expect(body.parent.data_source_id).toBe('ds_999');
    expect(body.parent.type).toBe('data_source_id');
    // defaults
    const props = body.properties;
    expect(props.Name.title[0].text.content).toBe('春分の日');
    expect(props.Date.date.start).toBe('2025-03-20');
    expect(props.Category.select.name).toBe('Public');
  });
});
