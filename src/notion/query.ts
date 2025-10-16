import { Client } from '@notionhq/client';

interface QueryResultItem {
  id: string;
  properties?: Record<string, any>;
}

interface QueryResponse {
  results?: QueryResultItem[];
  has_more?: boolean;
  next_cursor?: string | null;
}

function buildKey(date: string, title: string): string {
  return `${date}__${title}`;
}

export async function queryExistingHolidayKeys(
  notionToken: string,
  dataSourceId: string,
  dateProp: string,
  titleProp: string,
  fromIso: string,
  toIso: string,
): Promise<Set<string>> {
  const notion = new Client({ auth: notionToken, notionVersion: '2025-09-03' });
  const keys = new Set<string>();
  let cursor: string | undefined;

  for (;;) {
    const body: any = {
      filter: {
        and: [
          { property: dateProp, date: { on_or_after: fromIso } },
          { property: dateProp, date: { on_or_before: toIso } },
        ],
      },
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: dateProp, direction: 'ascending' }],
    };

    const res = (await notion.request({
      method: 'post',
      path: `data_sources/${dataSourceId}/query`,
      body,
    })) as QueryResponse;

    for (const row of res.results ?? []) {
      const props = row.properties || {};
      const dateVal =
        props[dateProp]?.date?.start || props[dateProp]?.date?.start_date || '';
      const titleVal =
        props[titleProp]?.title?.[0]?.plain_text ||
        props[titleProp]?.title?.[0]?.text?.content ||
        '';
      if (dateVal && titleVal) keys.add(buildKey(dateVal, titleVal));
    }

    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor as string;
  }

  return keys;
}
