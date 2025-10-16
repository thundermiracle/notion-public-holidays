import { Client } from '@notionhq/client';
import fs from 'node:fs';
import path from 'node:path';

// ---------- Tiny .env loader (no deps) ----------
function loadEnvFromDotEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const l = trimmed.startsWith('export ')
        ? trimmed.slice(7).trim()
        : trimmed;
      const eq = l.indexOf('=');
      if (eq === -1) continue;
      const key = l.slice(0, eq).trim();
      let value = l.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}
loadEnvFromDotEnv();

// ---------- Types ----------
type CliOptions = {
  year?: number;
  from?: string; // YYYYMMDD
  to?: string; // YYYYMMDD
  dryRun: boolean;
  dataSourceId?: string;
  titleProp?: string;
  dateProp?: string;
  tagProp?: string;
  tagValue?: string;
};

type Holiday = { date: string; name: string };

// ---------- CLI ----------
function printHelpAndExit(): never {
  console.log(`Usage: tsx src/create-holidays.ts [options]

Options:
  --year <yyyy>           Target year (default: current year)
  --from <yyyymmdd>       Start date (overrides --year)
  --to <yyyymmdd>         End date (overrides --year)
  --data-source-id <id>   Notion data source ID (env NOTION_DATA_SOURCE_ID)
  --title-prop <name>     Title property name (default: env NOTION_TITLE_PROP or "Name")
  --date-prop <name>      Date property name (default: env NOTION_DATE_PROP or "Date")
  --tag-prop <name>       Tag select prop name (default: env NOTION_TAG_PROP)
  --tag-value <value>     Tag select value (default: env NOTION_TAG_VALUE or "祝日")
  --dry-run               Do not write to Notion, only log actions
  -h, --help              Show help
`);
  process.exit(0);
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case '--year':
        if (!next) throw new Error('--year requires a value');
        opts.year = Number(next);
        i++;
        break;
      case '--from':
        if (!next) throw new Error('--from requires a value');
        opts.from = next;
        i++;
        break;
      case '--to':
        if (!next) throw new Error('--to requires a value');
        opts.to = next;
        i++;
        break;
      case '--data-source-id':
        if (!next) throw new Error('--data-source-id requires a value');
        opts.dataSourceId = next;
        i++;
        break;
      case '--title-prop':
        if (!next) throw new Error('--title-prop requires a value');
        opts.titleProp = next;
        i++;
        break;
      case '--date-prop':
        if (!next) throw new Error('--date-prop requires a value');
        opts.dateProp = next;
        i++;
        break;
      case '--tag-prop':
        if (!next) throw new Error('--tag-prop requires a value');
        opts.tagProp = next;
        i++;
        break;
      case '--tag-value':
        if (!next) throw new Error('--tag-value requires a value');
        opts.tagValue = next;
        i++;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelpAndExit();
        break;
      default:
        /* ignore unknown */ break;
    }
  }
  return opts;
}

// ---------- Utils ----------
function toIsoDate(d: string): string {
  const s = d.trim();
  const m = s.match(/^(\d{4})(?:[-\/]?)(\d{2})(?:[-\/]?)(\d{2})$/);
  if (!m) throw new Error(`Unrecognized date: ${d}`);
  const [, y, mo, da] = m;
  return `${y}-${mo}-${da}`;
}

function ymddToIso(d: string): string {
  // input like 20250101
  return toIsoDate(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);
}

function normalizeHolidays(json: Record<string, string>): Holiday[] {
  return Object.entries(json || {})
    .map(([yyyymmdd, name]) => ({
      date: ymddToIso(yyyymmdd),
      name: String(name),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchHolidays(from: string, to: string): Promise<Holiday[]> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(
    `https://jp-holidays.vercel.app/api/v1/holidays?${params.toString()}`,
  );
  if (!res.ok)
    throw new Error(
      `Failed to fetch holidays: ${res.status} ${res.statusText}`,
    );
  const json = (await res.json()) as Record<string, string>;
  const list = normalizeHolidays(json);
  if (!list.length) throw new Error('No holidays parsed from API response.');
  return list;
}

function keyOf(h: Pick<Holiday, 'date' | 'name'>): string {
  return `${h.date}__${h.name}`;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  max = 5,
): Promise<T> {
  let attempt = 0;
  let delay = 500;
  for (;;) {
    try {
      return await fn();
    } catch (e: any) {
      attempt++;
      const status = e?.status ?? e?.code ?? e?.response?.status;
      const retryable = status === 429 || (status >= 500 && status < 600);
      if (!retryable || attempt >= max) throw e;
      await sleep(delay);
      delay = Math.min(delay * 2, 8000);
    }
  }
}

// ---------- Config ----------
function resolveConfig(cli: CliOptions) {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const year = cli.year ?? defaultYear;

  const conf = {
    NOTION_TOKEN: process.env.NOTION_TOKEN || process.env.NOTION_API_KEY,
    NOTION_VERSION: process.env.NOTION_VERSION || '2025-09-03',
    DATA_SOURCE_ID: cli.dataSourceId || process.env.NOTION_DATA_SOURCE_ID,
    TITLE_PROP: cli.titleProp || process.env.NOTION_TITLE_PROP || 'Name',
    DATE_PROP: cli.dateProp || process.env.NOTION_DATE_PROP || 'Date',
    TAG_PROP: cli.tagProp ?? process.env.NOTION_TAG_PROP, // optional
    TAG_VALUE: cli.tagValue ?? process.env.NOTION_TAG_VALUE ?? '祝日',
    FROM: cli.from ?? `${year}0101`,
    TO: cli.to ?? `${year}1231`,
    DRY_RUN: cli.dryRun,
  };

  if (!conf.NOTION_TOKEN)
    throw new Error('Missing NOTION_TOKEN (or NOTION_API_KEY)');
  if (!conf.DATA_SOURCE_ID)
    throw new Error('Missing NOTION_DATA_SOURCE_ID (or --data-source-id)');
  return conf;
}

// ---------- Notion helpers ----------
type QueryResponse = {
  results?: Array<{ id: string; properties?: Record<string, any> }>;
  has_more?: boolean;
  next_cursor?: string | null;
};

async function queryAllWithinDateRange(
  notion: Client,
  dataSourceId: string,
  dateProp: string,
  fromIso: string,
  toIso: string,
  titleProp: string,
): Promise<Set<string>> {
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

    const res = await withRetry<QueryResponse>(
      () =>
        notion.request({
          method: 'post',
          path: `data_sources/${dataSourceId}/query`,
          body,
        }),
      'queryAllWithinDateRange',
    );

    for (const r of res.results ?? []) {
      const props = r.properties || {};
      const date =
        props[dateProp]?.date?.start || props[dateProp]?.date?.start_date || '';
      const title =
        props[titleProp]?.title?.[0]?.plain_text ||
        props[titleProp]?.title?.[0]?.text?.content ||
        '';
      if (date && title) keys.add(keyOf({ date, name: title }));
    }

    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor as string;
  }

  return keys;
}

async function createPage(
  notion: Client,
  dataSourceId: string,
  titleProp: string,
  dateProp: string,
  tagProp: string | undefined,
  tagValue: string,
  h: Holiday,
) {
  const properties: Record<string, any> = {
    [titleProp]: { title: [{ text: { content: h.name } }] },
    [dateProp]: { date: { start: h.date } },
  };
  if (tagProp) properties[tagProp] = { select: { name: tagValue } };

  await withRetry(
    () =>
      notion.request({
        method: 'post',
        path: 'pages',
        body: {
          parent: { type: 'data_source_id', data_source_id: dataSourceId },
          properties,
        },
      }),
    'createPage',
  );
}

// ---------- Main ----------
async function main() {
  const opts = parseArgs(process.argv);
  const C = resolveConfig(opts);

  console.log(`Fetching holidays ${C.FROM} .. ${C.TO} ...`);
  const holidays = await fetchHolidays(C.FROM, C.TO);
  console.log(`Holidays: ${holidays.length} items.`);

  if (C.DRY_RUN) {
    for (const h of holidays) console.log(`${h.date}  ${h.name}`);
    return;
  }

  const notion = new Client({
    auth: C.NOTION_TOKEN,
    notionVersion: C.NOTION_VERSION,
  });
  const fromIso = ymddToIso(C.FROM);
  const toIso = ymddToIso(C.TO);

  // 既存ページを一括取得してキー化（date + title）
  console.log('Scanning existing pages in range...');
  const existing = await queryAllWithinDateRange(
    notion,
    C.DATA_SOURCE_ID!,
    C.DATE_PROP,
    fromIso,
    toIso,
    C.TITLE_PROP,
  );
  console.log(`Found ${existing.size} existing items in Notion.`);

  let created = 0,
    skipped = 0;
  for (const h of holidays) {
    const k = keyOf(h);
    if (existing.has(k)) {
      skipped++;
      continue;
    }
    await createPage(
      notion,
      C.DATA_SOURCE_ID!,
      C.TITLE_PROP,
      C.DATE_PROP,
      C.TAG_PROP,
      C.TAG_VALUE,
      h,
    );
    created++;
    console.log(`Page Created: ${h.date} ${h.name}`);
    await sleep(200); // gentle pacing
  }

  console.log(`Done. Created: ${created}, Skipped: ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
