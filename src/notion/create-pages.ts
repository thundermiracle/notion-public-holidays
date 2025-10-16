import { Client } from '@notionhq/client';

import { queryExistingHolidayKeys } from './query';

import type { HolidayItem } from '../types';

export interface PropertyNames {
  title?: string; // default: Name
  date?: string; // default: Date
  category?: string; // default: Category
}

export interface CreateHolidayPagesParams {
  dataSourceId: string;
  holidays: HolidayItem[];
  propertyNames?: PropertyNames;
  notionToken: string;
  skipDuplicates?: boolean; // default: true
  year?: number; // if omitted, inferred from holidays[0] or current year
}

export async function createHolidayPages({
  dataSourceId,
  holidays,
  propertyNames = {},
  notionToken,
  skipDuplicates = true,
  year,
}: CreateHolidayPagesParams): Promise<void> {
  const notion = new Client({ auth: notionToken, notionVersion: '2025-09-03' });
  const titleProp = propertyNames.title || 'Name';
  const dateProp = propertyNames.date || 'Date';
  const categoryProp = propertyNames.category || 'Category';

  let toCreate = holidays;
  if (skipDuplicates) {
    const y =
      year ??
      (holidays[0]?.date?.slice(0, 4)
        ? Number(holidays[0].date.slice(0, 4))
        : new Date().getFullYear());
    const fromIso = `${y}-01-01`;
    const toIso = `${y}-12-31`;
    const existing = await queryExistingHolidayKeys(
      notionToken,
      dataSourceId,
      dateProp,
      titleProp,
      fromIso,
      toIso,
    );
    const buildKey = (it: Pick<HolidayItem, 'date' | 'title'>) =>
      `${it.date}__${it.title}`;
    toCreate = holidays.filter((it) => !existing.has(buildKey(it)));
  }

  for (const holiday of toCreate) {
    const properties: Record<string, any> = {
      [titleProp]: { title: [{ text: { content: holiday.title } }] },
      [dateProp]: { date: { start: holiday.date } },
      [categoryProp]: { select: { name: holiday.category } },
    };

    await notion.request({
      method: 'post',
      path: 'pages',
      body: {
        parent: { type: 'data_source_id', data_source_id: dataSourceId },
        properties,
      },
    });
  }
}
